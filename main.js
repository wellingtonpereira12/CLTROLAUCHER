const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const crypto = require('crypto');
const { execFile, exec } = require('child_process'); // IMPORTAÇÃO ADICIONADA exec

const PATCH_LIST_URL = 'http://31.97.28.102/patch/patchlist.json';

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 900,
    resizable: false, 
    frame: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    }
  });

  win.loadFile('index.html');
}

async function calcularMD5(caminho) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(caminho);
    stream.on('error', err => reject(err));
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

async function baixarArquivo(arquivo, destino, onProgresso) {
  const response = await axios({
    url: arquivo.url,
    method: 'GET',
    responseType: 'stream'
  });

  const totalLength = response.headers['content-length'];
  let baixado = 0;

  return new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(destino);
    response.data.on('data', (chunk) => {
      baixado += chunk.length;
      if (onProgresso && totalLength) {
        onProgresso((baixado / totalLength) * 100);
      }
    });
    response.data.pipe(writer);

    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

ipcMain.on('iniciar-patch', async (event) => {
  try {
    event.reply('status', 'Buscando lista de patches...');
    const res = await axios.get(PATCH_LIST_URL);
    const arquivos = res.data;

    const pastaExe = path.dirname(process.execPath); 

    let executavelParaRodar = null;

    for (const arquivo of arquivos) {
      const destino = path.join(pastaExe, arquivo.arquivo);
      let md5Atual = null;

      if (fs.existsSync(destino)) {
        md5Atual = await calcularMD5(destino);
      }
      if (md5Atual !== arquivo.md5) {
        event.reply('status', `Baixando ${arquivo.arquivo}...`);
        await baixarArquivo(arquivo, destino, (p) => {
          event.reply('progresso', { arquivo: arquivo.arquivo, progresso: p.toFixed(2) });
        });

        const md5Novo = await calcularMD5(destino);
        if (md5Novo !== arquivo.md5) {
          event.reply('erro', `Falha na verificação de MD5 para ${arquivo.arquivo}`);
          return;
        }
      } else {
        event.reply('status', `${arquivo.arquivo} já está atualizado.`);
      }

      if (!executavelParaRodar && arquivo.arquivo.toLowerCase().endsWith('.exe')) {
        executavelParaRodar = path.resolve(pastaExe, arquivo.arquivo);
      }
    }

    event.reply('status', 'Patch concluído! Iniciando o jogo...');

    if (executavelParaRodar && fs.existsSync(executavelParaRodar)) {
      executarComoAdmin(executavelParaRodar, (err) => {
        if (err) {
          event.reply('erro', 'Erro ao iniciar o jogo: ' + err.message);
        } else {
          event.reply('status', 'Jogo iniciado com sucesso!');
        }
      });
    } else {
      event.reply('erro', 'Executável para iniciar não encontrado.');
    }
  } catch (err) {
    event.reply('erro', 'Erro na verificação: ' + err.message);
  }
});

function executarComoAdmin(caminhoExe, callback) {
  const comando = `powershell -Command Start-Process -FilePath '${caminhoExe}' -Verb runAs`;

  exec(comando, (error, stdout, stderr) => {
    if (error) {
      callback(error);
    } else {
      callback(null);
    }
  });
}


ipcMain.on('abrir-configuracoes', (event) => {
  const setupPath = path.join(process.cwd(), 'Setup.exe');

  execFile(setupPath, (error, stdout, stderr) => {
    if (error) {
      console.error(`Erro ao abrir Setup.exe: ${error.message}`);
      return;
    }
    console.log(`Saída: ${stdout}`);
    if (stderr) {
      console.error(`Erro padrão: ${stderr}`);
    }
  });
});