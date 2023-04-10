import jwt from 'jsonwebtoken'
import { Status } from '../storage/model'
import { getUserById,getUserToken } from '../storage/mongo'
import { getCacheConfig } from '../storage/config'
import { tokenMap } from './auth'

const rootAuth = async (req, res, next) => {
  const config = await getCacheConfig()
  if (config.siteConfig.loginEnabled) {
    try {
      const token = req.header('Authorization').replace('Bearer ', '')
      const info = jwt.verify(token, config.siteConfig.loginSalt.trim())
      let userId = info.userId.toString()
      let mytoken = tokenMap.get(userId)
      if(mytoken==null ||  mytoken !== token){
        //   console.log("本地缓存为空，准备查询数据获取token")
          mytoken = await getUserToken(info.userId)
      }
      if(mytoken!==null&&mytoken==token){
        //  console.log("token对比成功，认证通过")
         tokenMap.set(userId,mytoken)
         req.headers.userId = info.userId
         const user = await getUserById(info.userId)
         if (user == null || user.status !== Status.Normal || user.email.toLowerCase() !== process.env.ROOT_USER)
           res.send({ status: 'Fail', message: '无权限 | No permission.', data: null })
         else
           next()

      } else{
         console.log("本地缓存与数据均未查询到token")
         res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
      }
    }
    catch (error) {
        //  console.log("token对比成功，但是发生异常"+error.message)
      res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
    }
  }
  else {
    res.send({ status: 'Fail', message: '无权限 | No permission.', data: null })
  }
}

export { rootAuth }
