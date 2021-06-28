import crypto from 'crypto';
// import popups from 'popups';
import express from 'express';
import cors from 'cors';
import chokidar from 'chokidar';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import 'dotenv/config';
const DATE = new Date(Date.now());

const CancelToken = axios.CancelToken;
const source = CancelToken.source();
const config = axios.create({
  timeout: 5000,
  baseUrl: process.env.BASE_URL,
  port: process.env.PORT,

  CancelToken: source.token,
});
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
const PORT = config.defaults.port;
process.chdir(path.join(`../${process.env.PARENT_DIRECTORY}`));
//Route to filewatching folder
const watcher = chokidar.watch(process.cwd(), {
  awaitWriteFinish: true,
  ignoreInitial: true,
});
const generateChecksum = (str, alg, encoding) =>
  crypto
    .createHash(alg || 'md5')
    .update(str, 'utf8')
    .digest(encoding || 'hex');

// Function does weird things, avoid for now
const moveFileLocation = (oldPath, newPath) =>
  fs.rename(oldPath, newPath, err => {
    if (err) throw err;
    console.log('File Move Successful');
  });
// Creates file for exceptions and logs
// Note: if file already exsists, the content will be overwritten

const createFile = (filePath, extensionType, fileContent) => {
  const stamp = DATE.toISOString().replace(/[:.]/g, '');
  const ext = extensionType;
  const fileName = `${stamp}${ext}`;

  //Move to createFile
  try {
    fileName.concat(stamp, ext);
    fs.appendFile(path.join(filePath, fileName), fileContent, err => {
      if (err) {
        fs.writeFile(path.join(p, fileName), fileContent, err => {
          if (err) console.log(err);
          console.log('File is created successfully.');
        });
      }
    });
  } catch (err) {
    console.log(err);
  }
};

const exceptionHandler = (errorMessage, p) => {};

// data for handler not being posted to file. Possible .ext issue
exceptionHandler('bad request there sir', '1000000/exceptions');

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
              },
              console.log('New directory added by system')
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
      baseURL: process.env.BASE_URL,
      method,
      url: `/${route}/results`,
      data: { ...data },
    });

    if (response.status === 200) {
      console.log(route, response.data);
      archiveFile(data);
    }

    return response.data;
  } catch (err) {
    console.log(err);
  }
};
watcher.on('ready', () => {
  console.log('Program initialized. Listening for changes...');
  watcher
    .on('add', (p, stats) => {
      console.log(path.extname(p));
      const TARGET_DIRECTORY = p
        .split(path.sep)
        .splice(p.split(path.sep).indexOf(process.env.PARENT_DIRECTORY));

      const ROUTE = [TARGET_DIRECTORY[1], TARGET_DIRECTORY[2]].join('/');
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
    })
    .on('change', (p, stats) => {});
});

const watchedPaths = watcher.getWatched();

app.get('/', (req, res) => console.log('hey'));

app.listen(PORT, () => console.log(`Server running on port: ${PORT}`));
