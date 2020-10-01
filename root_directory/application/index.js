require('dotenv/config');
const crypto = require('crypto');
const express = require('express');
const cors = require('cors');
const chokidar = require('chokidar');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const { get } = require('https');
const CancelToken = axios.CancelToken;
const source = CancelToken.source();
const config = axios.create({
  timeout: 5000,
  baseUrl: 'http://localhost:8080',
  port: 8080,

  CancelToken: source.token,
});
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const PORT = process.env.PORT || 3000;
process.chdir(path.join(`../${process.env.PARENT_DIRECTORY}`));
//Route to filewatching folder
const watcher = chokidar.watch(process.cwd(), {
  awaitWriteFinish: true,
});
const generateChecksum = (str, alg, encoding) =>
  crypto
    .createHash(alg || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex');
const moveFileLocation = (oldPath, newPath) =>
  fs.rename(oldPath, newPath, err => {
    if (err) throw err;
    console.log('File Move Successful');
  });
const getUserDate = () => {
  const months = [
    'January',
    'February',
    'March',
    'April',
    'May',
    'June',
    'July',
    'August',
    'September',
    'October',
    'November',
    'December',
  ];
  const today = new Date(Date.now());
  const date = { year: today.getFullYear(), month: months[today.getMonth()] };
  return date;
};
const archiveFile = async ({ SUB_DIRECTORY, FOLDER, FILENAME }) => {
  const { year, month } = getUserDate();
  if (FOLDER !== 'archive') {
    console.log(FOLDER);

    fs.access(
      path.join(SUB_DIRECTORY, 'archive', year.toString(), month),
      err => {
        if (err) {
          try {
            fs.mkdir(
              path.join(SUB_DIRECTORY, 'archive', year.toString(), month),
              { recursive: true },
              err => {
                if (err) throw err;
                fs.rename(
                  path.join(SUB_DIRECTORY, FOLDER, FILENAME),
                  path.join(
                    SUB_DIRECTORY,
                    'archive',
                    year.toString(),
                    month,
                    FILENAME
                  ),
                  err => {
                    if (err) throw err;
                  }
                );
              }
            );
          } catch (err) {
            alert('Sorry something went wrong, please try again.');
            console.log(err, 'from mkdir');
          }
        }
        fs.rename(
          path.join(SUB_DIRECTORY, FOLDER, FILENAME),
          path.join(SUB_DIRECTORY, 'archive', year.toString(), month, FILENAME),
          err => {
            if (err) {
              console.log(err);
            }
            console.log('Rename successful');
          }
        );
      }
    );
  }
};

const postRequest = route => {
  app.post(`/${route}/results`, async (req, res) => {
    const { path, PARENT_DIRECTORY, SUB_DIRECTORY, checksum, stats } = req.body;
    //Compare sent checksum to system
    try {
      if (checksum === generateChecksum(fs.readFileSync(path, 'utf-8')))
        res.status(200).json({ status: 'success', data: { checksum } });
    } catch (err) {
      res.status(404).json({ status: 'fail', data: { err } });
    }
  });
};

const makeRequest = async (route, method, data) => {
  try {
    postRequest(route);
    const response = await axios({
      baseURL: 'http://localhost:8080',
      method,
      url: `/${route}/results`,
      data,
    });

    if (response.status === 200) {
      archiveFile(data);
    }

    return response.data;
  } catch (err) {
    console.log(err);
  }
};
watcher.on('change', (p, stats) => {
  console.log(path.basename(p));
  const TARGET_DIRECTORY = p
    .split(path.sep)
    .splice(p.split(path.sep).indexOf(process.env.PARENT_DIRECTORY));
  const ROUTE = [TARGET_DIRECTORY[0], TARGET_DIRECTORY[1]].join('/');
  const fileData = fs.readFileSync(p, 'utf-8');
  const data = {
    path: p,
    PARENT_DIRECTORY: TARGET_DIRECTORY[0],
    SUB_DIRECTORY: TARGET_DIRECTORY[1],
    FOLDER: TARGET_DIRECTORY[2],
    FILENAME: path.basename(p),
    checksum: generateChecksum(fileData),
    stats,
  };

  makeRequest(ROUTE, 'POST', data);
});

const watchedPaths = watcher.getWatched();

app.get('/', (req, res) => console.log('hey'));

app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
