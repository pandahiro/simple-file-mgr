const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });
const baseDir = "./server";

// Configuração para servir arquivos estáticos do Monaco
app.use(
  "/monaco",
  express.static(path.join(__dirname, "node_modules/monaco-editor/min"))
);
app.use("/public", express.static("public"));
app.use(express.urlencoded({ extended: true }));
app.use(express.json())
app.set("view engine", "ejs");
if (!fs.existsSync(baseDir)) {
  fs.mkdirSync(baseDir, { recursive: true });
  console.log('Directory "server" created!');
} else {
  console.log('Directory "server" already exists.');
}


// Função para verificar se um arquivo é binário
function isBinary(filePath) {
  const sampleSize = 512;
  const buffer = fs.readFileSync(filePath, {
    encoding: null,
    length: sampleSize,
  });
  return buffer.includes(0); // Presença de NULL indica binário
}

// Listar arquivos em um diretório
function listFilesInDirectory(dir) {
  return fs.readdirSync(dir).map((file) => {
    const filePath = path.join(dir, file);
    const isDirectory = fs.statSync(filePath).isDirectory();
    return { name: file, isDirectory };
  })
  .sort((a, b) => {
    if (a.isDirectory === b.isDirectory) {
      return a.name.localeCompare(b.name);
    }
    return a.isDirectory ? -1 : 1; // Directories first
  });
}

// Listar arquivos
app.get("/", (req, res) => {
  const dir = req.query.dir ? path.join(baseDir, req.query.dir) : baseDir;

  if (!fs.existsSync(dir)) {
    return res.status(404).send("Diretório não encontrado.");
  }

  const files = listFilesInDirectory(dir);
  res.render("index", { files, currentDir: req.query.dir || "" });
});

// Rota para editar arquivo
app.get("/edit/*", (req, res) => {
  const filePath = path.join(baseDir, req.params[0]);

  let paths = req.params[0];
  let parts = paths.split('/'); 
  parts.pop();
  let result = "/?dir=" + parts.join('/');
  // Verifica se o arquivo é de texto ou binário
  const binary = isBinary(filePath);
  if (binary) {
    return res.render("edit", {
      fileName: req.params[0].split("/").pop(),
      content: null,
      isBinary: true,
      result
    });
  }

  fs.readFile(filePath, "utf-8", (err, content) => {
    if (err) return res.status(500).send("Erro ao ler o arquivo.");
    res.render("edit", { fileName: req.params[0].split("/").pop(), content, isBinary: false, result: result });
  });
});
app.post("/edit/*", (req, res) => {
  const filePath = path.join(baseDir, req.params[0]);
  console.log(req.body)
  fs.writeFile(filePath, req.body.content, "utf-8", (err) => {
    if (err) return res.status(500).send("Erro ao salvar o arquivo.");
    res.status(200).send("Pronto!")
  });
});

// Baixar o arquivo
app.get("/download/*", (req, res) => {
  const filePath = path.join(baseDir, req.params[0]);
  res.download(filePath);
});

app.get("/delete/*", (req, res) => {
  const filePath = path.join(baseDir, req.params[0]);

  // Verifica se o caminho existe
  fs.stat(filePath, (err, stats) => {
    if (err) return res.status(500).send("Erro ao acessar o arquivo ou pasta.");

    let path = req.params[0];
    let parts = path.split('/'); 
    parts.pop();
    let result = parts.join('/');
    // Se for um arquivo, remove-o
    if (stats.isFile()) {
      fs.rm(filePath, (err) => {
        if (err) return res.status(500).send("Erro ao deletar o arquivo.");
        res.redirect("/?dir=" + result);
      });
    }
    // Se for uma pasta, remove-a
    else if (stats.isDirectory()) {
      fs.rm(filePath, { recursive: true, force: true }, (err) => {
        if (err) return res.status(500).send("Erro ao deletar a pasta.");
        res.redirect("/?dir=" + result);
      });
    }
  });
});

// Upload e download de arquivos
app.post("/upload", upload.single("file"), (req, res) => {
  try {
    const oldPath = req.file.path;
    const newPath = path.join(
      baseDir,
      req.body.dir || "",
      req.file.originalname
    );
    fs.rename(oldPath, newPath, (err) => {
      if (err) return res.status(500).send("Erro ao mover o arquivo.");
      res.redirect("/?dir=" + req.body.dir);
    });
  } catch (e) {
    console.log(e);
    res.redirect("/");
  }
});

// Criar novo diretório
app.post("/create-directory", (req, res) => {
  const dirPath = path.join(baseDir, req.body.subdir, req.body.dirName);
  fs.mkdir(dirPath, (err) => {
    if (err) return res.status(500).send("Erro ao criar diretório.");
    res.redirect("/?dir=" + req.body.subdir);
  });
});

app.post("/create-file", (req, res) => {
  const dirPath = path.join(baseDir, req.body.subdir, req.body.fileName);
  fs.writeFile(dirPath, "", (err) => {
    if (err) return res.status(500).send("Erro ao criar arquivo.");
    res.redirect("/?dir=" + req.body.subdir);
  });
});

// Inicia o servidor
app.listen(3000, () => {
  console.log("Servidor rodando em http://localhost:3000");
});
