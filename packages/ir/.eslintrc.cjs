// .eslintrc.cjs
module.exports = {
  rules: {
    "no-restricted-globals": [
      "error",
      { name: "window", message: "Đang code Isomorphic, không dùng window." },
      { name: "document", message: "Đang code Isomorphic, không dùng document." },
      { name: "localStorage", message: "Dùng adapter Storage thay vì localStorage." }
    ]
  }
};
