const shell = require("shelljs");
const path = require("path");
const fs = require("fs");
const axios = require("axios");
const qs = require("qs");
const sha256 = require("sha256");
const chalk = require("chalk");
const FormData = require("form-data");
// const gitStatusExec = shell.exec("git status --porcelain");
// console.log(gitStatusExec.code, gitStatusExec.stdout);
// gitStatusExec.code === 0 执行没问题
// gitStatusExec.stdout.trim().length > 0 有修改了未提交的文件
let token = "";
const baseURL = "http://47.106.73.220:7001";
const username = process.argv[2] || "";
const password = process.argv[3] || "";

const ins = axios.create({
  baseURL,
  headers: {
    "Content-type": "application/x-www-form-urlencoded;charset=UTF-8",
  },
});

ins.interceptors.request.use(
  function (config) {
    config.headers.common["scp-token"] = token.toString();
    return config;
  },
  function (error) {
    fail(error);
    return Promise.reject(error);
  }
);

function succ(msg) {
  console.log(chalk.greenBright("success", msg));
}

function fail(msg) {
  console.log(chalk.redBright("fail", msg));
  process.exit(0);
}

async function handle() {
  console.log("准备进行【压缩】操作");

  const tarExec = shell.exec(`tar -zcvf ./dist.tgz dist`);
  if (tarExec.code !== 0) {
    fail("scp 压缩失败");
  }

  succ("压缩完成");
  console.log("准备进行【上传】操作");
  // 创建stream
  const buffer = fs.createReadStream(path.resolve(__dirname, "dist.tgz"));
  const formdata = new FormData();
  formdata.append("file", buffer);
  const headers = formdata.getHeaders();
  formdata.getLength(async (err, length) => {
    headers["content-length"] = length;
    const res = await axios.post(baseURL + "/scp/scpUpload", formdata, {
      headers: {
        ...headers,
        "scp-token": token.toString(),
      },
    });

    console.log(res.data);

    if (res.data.code !== 0) {
      fail(res.data.msg);
    }
    succ(res.data.msg);
    shell.exec(`rm -f ${path.resolve(__dirname, "dist.tgz")}`);
    succ("ok");
  });
}

async function checkScpLogin() {
  if (!fs.existsSync(path.resolve(__dirname, "scp.t.json"))) {
    // 找不到登陆token
    fail("未登陆，请加上参数：-u 用户名 -p 密码");
    return;
  }

  token = fs.readFileSync(path.resolve(__dirname, "scp.t.json"));
  if (!token || !token.toString()) {
    fail("登陆状态丢失，请重新登陆");
    return;
  }

  succ("登陆状态ok");

  handle();
}

async function login() {
  const res = await ins.post(
    "/scp/login",
    qs.stringify({
      username,
      password: sha256(password),
    })
  );
  const { code, msg, data } = res.data;
  if (code !== 0) {
    fail(msg);
    return;
  }
  succ(msg);
  const err = fs.writeFileSync(
    path.resolve(__dirname, "scp.t.json"),
    data.token,
    "utf8"
  );
  if (err) {
    return fail("创建 scp.t.json 失败");
  }
  succ(
    `请运行

      npm run scp

    `
  );
}

function main() {
  if (username && password) {
    // 登陆
    login();
  } else {
    checkScpLogin();
  }
}

main();
