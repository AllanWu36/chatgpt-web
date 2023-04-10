import './config'; // 首先加载 config.ts 文件
import express from 'express'
import jwt from 'jsonwebtoken'
import * as dotenv from 'dotenv'
import type { RequestProps } from './types'
import type { ChatContext, ChatMessage } from './chatgpt'
import { chatConfig, chatReplyProcess, currentModel, initApi } from './chatgpt'
import { auth,tokenMap } from './middleware/auth'
import { clearConfigCache, getCacheConfig, getOriginConfig } from './storage/config'
import type { ChatOptions, Config, MailConfig, SiteConfig, UsageResponse, UserInfo } from './storage/model'
import { Status } from './storage/model'
import {
  clearChat,
  createChatRoom,
  createUser,
  deleteAllChatRooms,
  deleteChat,
  deleteChatRoom,
  existsChatRoom,
  getChat,
  getChatRooms,
  getChats,
  getUser,
  getUserById,
  insertChat,
  insertChatUsage,
  renameChatRoom,
  updateChat,
  updateConfig,
  updateUserInfo,
  verifyUser,
  updateUserPassword,
  updateUserToken,
  getUserToken
} from './storage/mongo'
import { limiter } from './middleware/limiter'
import { isEmail, isNotEmptyString } from './utils/is'
import { sendNoticeMail, sendTestMail, sendVerifyMail, sendVerifyMailAdmin,sendMailOnResetPassword } from './utils/mail'
import { checkUserVerify, checkUserVerifyAdmin, getUserVerifyUrl, getUserVerifyUrlAdmin, md5 } from './utils/security'
import { rootAuth } from './middleware/rootAuth'
import { ObjectId } from 'mongodb'


dotenv.config()

const app = express()
const router = express.Router()

app.use(express.static('public'))
app.use(express.json())

app.all('*', (_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*')
  res.header('Access-Control-Allow-Headers', 'authorization, Content-Type')
  res.header('Access-Control-Allow-Methods', '*')
  next()
})

router.get('/chatrooms', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const rooms = await getChatRooms(userId)
    const result = []
    rooms.forEach((r) => {
      result.push({
        uuid: r.roomId,
        title: r.title,
        isEdit: false,
      })
    })
    res.send({ status: 'Success', message: null, data: result })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Load error', data: [] })
  }
})

router.post('/room-create', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { title, roomId } = req.body as { title: string; roomId: number }
    const room = await createChatRoom(userId, title, roomId)
    res.send({ status: 'Success', message: null, data: room })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Create error', data: null })
  }
})

router.post('/room-rename', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { title, roomId } = req.body as { title: string; roomId: number }
    const room = await renameChatRoom(userId, title, roomId)
    res.send({ status: 'Success', message: null, data: room })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Rename error', data: null })
  }
})

router.post('/room-delete', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { roomId } = req.body as { roomId: number }
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    await deleteChatRoom(userId, roomId)
    res.send({ status: 'Success', message: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.get('/chat-hisroty', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const roomId = +req.query.roomId
    const lastId = req.query.lastId as string
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Success', message: null, data: [] })
      // res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    const chats = await getChats(roomId, !isNotEmptyString(lastId) ? null : parseInt(lastId))

    const result = []
    chats.forEach((c) => {
      if (c.status !== Status.InversionDeleted) {
        result.push({
          uuid: c.uuid,
          dateTime: new Date(c.dateTime).toLocaleString(),
          text: c.prompt,
          inversion: true,
          error: false,
          conversationOptions: null,
          requestOptions: {
            prompt: c.prompt,
            options: null,
          },
        })
      }
      if (c.status !== Status.ResponseDeleted) {
        result.push({
          uuid: c.uuid,
          dateTime: new Date(c.dateTime).toLocaleString(),
          text: c.response,
          inversion: false,
          error: false,
          loading: false,
          conversationOptions: {
            parentMessageId: c.options.messageId,
            conversationId: c.options.conversationId,
          },
          requestOptions: {
            prompt: c.prompt,
            parentMessageId: c.options.parentMessageId,
            options: {
              parentMessageId: c.options.messageId,
              conversationId: c.options.conversationId,
            },
          },
        })
      }
    })

    res.send({ status: 'Success', message: null, data: result })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Load error', data: null })
  }
})

router.post('/chat-delete', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { roomId, uuid, inversion } = req.body as { roomId: number; uuid: number; inversion: boolean }
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    await deleteChat(roomId, uuid, inversion)
    res.send({ status: 'Success', message: null, data: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.post('/chat-clear-all', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    await deleteAllChatRooms(userId)
    res.send({ status: 'Success', message: null, data: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.post('/chat-clear', auth, async (req, res) => {
  try {
    const userId = req.headers.userId as string
    const { roomId } = req.body as { roomId: number }
    if (!roomId || !await existsChatRoom(userId, roomId)) {
      res.send({ status: 'Fail', message: 'Unknow room', data: null })
      return
    }
    await clearChat(roomId)
    res.send({ status: 'Success', message: null, data: null })
  }
  catch (error) {
    console.error(error)
    res.send({ status: 'Fail', message: 'Delete error', data: null })
  }
})

router.post('/chat', auth, async (req, res) => {
  try {
    const { roomId, uuid, regenerate, prompt, options = {} } = req.body as
      { roomId: number; uuid: number; regenerate: boolean; prompt: string; options?: ChatContext }
    const message = regenerate
      ? await getChat(roomId, uuid)
      : await insertChat(uuid, prompt, roomId, options as ChatOptions)
    const response = await chatReply(prompt, options)
    if (response.status === 'Success') {
      if (regenerate && message.options.messageId) {
        const previousResponse = message.previousResponse || []
        previousResponse.push({ response: message.response, options: message.options })
        await updateChat(message._id as unknown as string,
          response.data.text,
          response.data.id,
          response.data.detail.usage as UsageResponse,
          previousResponse)
      }
      else {
        await updateChat(message._id as unknown as string,
          response.data.text,
          response.data.id,
          response.data.detail.usage as UsageResponse)
      }

      if (response.data.usage) {
        await insertChatUsage(req.headers.userId as string,
          roomId,
          message._id,
          response.data.id,
          response.data.detail.usage as UsageResponse)
      }
    }
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/chat-process', [auth, limiter], async (req, res) => {
  res.setHeader('Content-type', 'application/octet-stream')

  try {
    const { roomId, uuid, regenerate, prompt, options = {}, systemMessage } = req.body as RequestProps
    const message = regenerate
      ? await getChat(roomId, uuid)
      : await insertChat(uuid, prompt, roomId, options as ChatOptions)
    let firstChunk = true
    const result = await chatReplyProcess({
      message: prompt,
      lastContext: options,
      process: (chat: ChatMessage) => {
        res.write(firstChunk ? JSON.stringify(chat) : `\n${JSON.stringify(chat)}`)
        firstChunk = false
      },
      systemMessage,
    })
    if (result.status === 'Success') {
      if (regenerate && message.options.messageId) {
        const previousResponse = message.previousResponse || []
        previousResponse.push({ response: message.response, options: message.options })
        await updateChat(message._id as unknown as string,
          result.data.text,
          result.data.id,
          result.data.detail.usage as UsageResponse,
          previousResponse)
      }
      else {
        await updateChat(message._id as unknown as string,
          result.data.text,
          result.data.id,
          result.data.detail.usage as UsageResponse)
      }

      if (result.data.detail.usage) {
        await insertChatUsage(req.headers.userId as string,
          roomId,
          message._id,
          result.data.id,
          result.data.detail.usage as UsageResponse)
      }
    }
  }
  
  catch (error) {
    res.write(JSON.stringify(error))
  }
  finally {
    res.end()
  }
})

router.post('/user-register', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    const config = await getCacheConfig()
    if (!config.siteConfig.registerEnabled) {
      res.send({ status: 'Fail', message: '注册账号功能未启用 | Register account is disabled!', data: null })
      return
    }
    if (!isEmail(username)) {
      res.send({ status: 'Fail', message: '请输入正确的邮箱 | Please enter a valid email address.', data: null })
      return
    }
    if (isNotEmptyString(config.siteConfig.registerMails)) {
      let allowSuffix = false
      const emailSuffixs = config.siteConfig.registerMails.split(',')
      for (let index = 0; index < emailSuffixs.length; index++) {
        const element = emailSuffixs[index]
        allowSuffix = username.toLowerCase().endsWith(element)
        if (allowSuffix)
          break
      }
      if (!allowSuffix) {
        res.send({ status: 'Fail', message: '该邮箱后缀不支持 | The email service provider is not allowed', data: null })
        return
      }
    }

    const user = await getUser(username)
    
    const newPassword = md5(password)
    if (user != null && user.status === Status.PreVerify){
      await updateUserPassword(user._id,newPassword)
  }else  if (user != null && user.status === Status.AdminVerify){
    res.send({ status: 'Fail', message: '邮箱注册已验证，请等待管理员审核', data: null })
    return
  }else  if (user != null) {
    res.send({ status: 'Fail', message: '邮箱已存在 | The email exists', data: null })
    return
  } 
  else{
      await createUser(username, newPassword)
  }
    

    if (username.toLowerCase() === process.env.ROOT_USER) {
      res.send({ status: 'Success', message: '注册成功 | Register success', data: null })
    }
    else {
      await sendVerifyMail(username, await getUserVerifyUrl(username))
      res.send({ status: 'Success', message: '注册成功, 去邮箱中验证吧 | Registration is successful, you need to go to email verification', data: null })
    }
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/config', auth, async (req, res) => {
  try {
    const userId = req.headers.userId.toString()

    const user = await getUserById(userId)
    if (user == null || user.status !== Status.Normal || user.email.toLowerCase() !== process.env.ROOT_USER)
      throw new Error('无权限 | No permission.')

    const response = await chatConfig()
    res.send(response)
  }
  catch (error) {
    res.send(error)
  }
})

router.post('/session', async (req, res) => {
  try {
    const config = await getCacheConfig()
    const hasAuth = config.siteConfig.loginEnabled
    const allowRegister = (await getCacheConfig()).siteConfig.registerEnabled
    res.send({ status: 'Success', message: '', data: { auth: hasAuth, allowRegister, model: currentModel() } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/user-login', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    if (!username || !password || !isEmail(username))
      throw new Error('用户名或密码为空 | Username or password is empty')

    const user = await getUser(username)
    if (user == null
      || user.status !== Status.Normal
      || user.password !== md5(password)) {
      if (user != null && user.status === Status.PreVerify)
        throw new Error('请去邮箱中验证 | Please verify in the mailbox')
      if (user != null && user.status === Status.AdminVerify)
        throw new Error('请等待管理员开通 | Please wait for the admin to activate')
      throw new Error('用户不存在或密码错误 | User does not exist or incorrect password.')
    }
    const config = await getCacheConfig()
    const token = jwt.sign({
      name: user.name ? user.name : user.email,
      avatar: user.avatar,
      description: user.description,
      userId: user._id,
      root: username.toLowerCase() === process.env.ROOT_USER,
    }, config.siteConfig.loginSalt.trim())
    await updateUserToken(user._id,token)
    tokenMap.set(user._id.toString(),token)
    res.send({ status: 'Success', message: '登录成功 | Login successfully', data: { token } })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/user-info', auth, async (req, res) => {
  try {
    const { name, avatar, description } = req.body as UserInfo
    const userId = req.headers.userId.toString()

    const user = await getUserById(userId)
    if (user == null || user.status !== Status.Normal)
      throw new Error('用户不存在 | User does not exist.')
    await updateUserInfo(userId, { name, avatar, description } as UserInfo)
    res.send({ status: 'Success', message: '更新成功 | Update successfully' })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verify', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')
    const username = await checkUserVerify(token)
    const user = await getUser(username)
    if (user != null && user.status === Status.Normal) {
      res.send({ status: 'Fail', message: '邮箱已存在 | The email exists', data: null })
      return
    }
    const config = await getCacheConfig()
    let message = '验证成功 | Verify successfully'
    if (config.siteConfig.registerReview) {
      console.log(username+"验证成功, 请等待管理员开通")
      await verifyUser(username, Status.AdminVerify)
      await sendVerifyMailAdmin(process.env.ROOT_USER, username, await getUserVerifyUrlAdmin(username))
      message = '验证成功, 请等待管理员开通 | Verify successfully, Please wait for the admin to activate'
    }
    else {
      console.log(username+"验证成功, 不需要管理员开通")
      await verifyUser(username, Status.Normal)
    }
    res.send({ status: 'Success', message, data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/verifyadmin', async (req, res) => {
  try {
    const { token } = req.body as { token: string }
    if (!token)
      throw new Error('Secret key is empty')
    const username = await checkUserVerifyAdmin(token)
    const user = await getUser(username)
    if (user != null && user.status === Status.Normal) {
      res.send({ status: 'Fail', message: '邮箱已开通 | The email has been opened.', data: null })
      return
    }
    await verifyUser(username, Status.Normal)
    await sendNoticeMail(username)
    res.send({ status: 'Success', message: '开通成功 | Activate successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/setting-base', rootAuth, async (req, res) => {
  try {
    const { apiKey, apiModel, apiBaseUrl, accessToken, timeoutMs, socksProxy, socksAuth, httpsProxy } = req.body as Config

    if (apiKey == null && accessToken == null)
      throw new Error('Missing OPENAI_API_KEY or OPENAI_ACCESS_TOKEN environment variable.')

    const thisConfig = await getOriginConfig()
    thisConfig.apiKey = apiKey
    thisConfig.apiModel = apiModel
    thisConfig.apiBaseUrl = apiBaseUrl
    thisConfig.accessToken = accessToken
    thisConfig.timeoutMs = timeoutMs
    thisConfig.socksProxy = socksProxy
    thisConfig.socksAuth = socksAuth
    thisConfig.httpsProxy = httpsProxy
    await updateConfig(thisConfig)
    clearConfigCache()
    initApi()
    const response = await chatConfig()
    res.send({ status: 'Success', message: '操作成功 | Successfully', data: response.data })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/setting-site', rootAuth, async (req, res) => {
  try {
    const config = req.body as SiteConfig

    const thisConfig = await getOriginConfig()
    thisConfig.siteConfig = config
    const result = await updateConfig(thisConfig)
    clearConfigCache()
    res.send({ status: 'Success', message: '操作成功 | Successfully', data: result.siteConfig })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/setting-mail', rootAuth, async (req, res) => {
  try {
    const config = req.body as MailConfig

    const thisConfig = await getOriginConfig()
    thisConfig.mailConfig = config
    const result = await updateConfig(thisConfig)
    clearConfigCache()
    res.send({ status: 'Success', message: '操作成功 | Successfully', data: result.mailConfig })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.post('/mail-test', rootAuth, async (req, res) => {
  try {
    const config = req.body as MailConfig
    const userId = req.headers.userId as string
    const user = await getUserById(userId)
    await sendTestMail(user.email, config)
    res.send({ status: 'Success', message: '发送成功 | Successfully', data: null })
  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

app.use('', router)
app.use('/api', router)
app.set('trust proxy', 1)


router.post('/reset-password', async (req, res) => {
  try {
    const { username, password } = req.body as { username: string; password: string }
    if (!username || !password)
      throw new Error('用户名或密码为空 | Username or password is empty')

    const user = await getUser(username)
    if (user == null
      || user.status !== Status.Normal
      || user.password !== md5(password)) {
      if (user != null && user.status === Status.PreVerify)
        throw new Error('你的注册信息还未认证，请先去邮箱中验证 | Please verify in the mailbox')
    }
    const config = await getCacheConfig()
    const timestamp = new Date().getTime()
    let verifytoken =password+'-'+md5(password)+'-'+timestamp+'-'+user._id
    console.log('加密前'+verifytoken)
    verifytoken =obfuscateString(verifytoken)
    let verifyUrl = process.env.SITE_DOMAIN+'/api/resetpwd-verify?verifytoken='+verifytoken
    await sendMailOnResetPassword(username,verifyUrl)
    res.send({ status: 'Success', message: '重置密码成功,请去邮箱中验证', data: null })

  }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})

router.get('/resetpwd-verify', async (req, res) => {
    try {
     resetpwdVerify(req,res)
    }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})
router.get('/api/resetpwd-verify', async (req, res) => {
    try {
     resetpwdVerify(req,res)
    }
  catch (error) {
    res.send({ status: 'Fail', message: error.message, data: null })
  }
})
async function resetpwdVerify(req, res){
   let verifytoken = req.query.verifytoken
    // console.log('verifytoken=='+verifytoken)
    verifytoken =deobfuscateString(verifytoken)
    // console.log('解密后'+verifytoken)
    const parts = verifytoken.split("-")
    let password = md5(parts[0])
    if(password !== parts[1]){
        res.send({ status: 'Fail', message: '验证失败，验证token不正确', data: null })
        return
    }
    const timestamp = new Date().getTime()
    let diffMin = (timestamp-parts[2])/1000/60
    if(diffMin>30){
        res.send({ status: 'Fail', message: '验证失败，链接已超时', data: null })
        return
    }
    await updateUserPassword(new ObjectId(parts[3]),password)
    res.send({ status: 'Success', message: '重置密码成功 | Verify successfully', data: null })
    // res.send({ status: 'Success', message: '验证成功 | Verify successfully', data: null })
}


 function obfuscateString(str: string): string {
     
    try{ let key = 8324
      let result = "";
      for (let i = 0; i < str.length; i++) {
          const charCode = str.charCodeAt(i);
          const newCharCode = charCode + key;
          result += String.fromCharCode(newCharCode);
     }
       return result
     }
     catch(error){
         return str
     }
}

 function deobfuscateString(obfuscatedStr: string ): string {
     try{
         let key = 8324
         let result = ""
        for (let i = 0; i < obfuscatedStr.length; i++) {
           const charCode = obfuscatedStr.charCodeAt(i)
           const originalCharCode = charCode - key
           result += String.fromCharCode(originalCharCode)
            
        }
      return result 
     }catch(error){
         return obfuscatedStr 
     }
}

app.listen(3002, () => globalThis.console.log('Server is running on port 3002'))
