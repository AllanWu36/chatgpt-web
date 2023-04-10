import dotenv from 'dotenv';
console.log("加载配置文件===============================================")
dotenv.config(); // 加载 .env 文件
console.log("加载配置文件===============================================END")
for (const key in process.env) {
  console.log(`${key} == ${process.env[key]}`);
}
