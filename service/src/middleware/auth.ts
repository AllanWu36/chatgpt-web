import jwt from 'jsonwebtoken'
import { getCacheConfig } from '../storage/config'
import { getUserToken } from '../storage/mongo'
export const tokenMap = new Map<string, any>()
const auth = async (req, res, next) => {
  const config = await getCacheConfig()
  if (config.siteConfig.loginEnabled) {
    try {
      const token = req.header('Authorization').replace('Bearer ', '')
      const info = jwt.verify(token, config.siteConfig.loginSalt.trim())
      let userId = info.userId.toString()
      let mytoken = tokenMap.get(userId)
      if(mytoken==null || mytoken !== token){
        //   console.log("本地缓存为空，准备查询数据获取token")
          mytoken = await getUserToken(info.userId)
      }
      if(mytoken!==null&&mytoken==token){
        //  console.log("token对比成功，认证通过")
         tokenMap.set(userId,mytoken)
         req.headers.userId = info.userId
         next()

      } else{
         console.log("本地缓存与数据均未查询到token")
         res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
      }
    }
    catch (error) {
      res.send({ status: 'Unauthorized', message: error.message ?? 'Please authenticate.', data: null })
    }
  }
  else {
    // fake userid
    req.headers.userId = '6406d8c50aedd633885fa16f'
    next()
  }
}

export { auth }
