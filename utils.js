const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');

function calcularMD5(caminho) {
  return new Promise((resolve, reject) => {
    if (!fs.existsSync(caminho)) return resolve(null);
    const hash = crypto.createHash('md5');
    const stream = fs.createReadStream(caminho);
    stream.on('data', chunk => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

async function baixarArquivo(arquivo, destino, onProgress) {
  const res = await axios({
    url: arquivo.url,
    method: 'GET',
    responseType: 'stream'
  });

  const total = parseInt(res.headers['content-length'], 10);
  let baixado = 0;

  const writer = fs.createWriteStream(destino);
  res.data.on('data', chunk => {
    baixado += chunk.length;
    const progresso = Math.round((baixado / total) * 100);
    onProgress(progresso);
  });

  res.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

module.exports = {
  calcularMD5,
  baixarArquivo
};
