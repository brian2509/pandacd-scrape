import * as Path from "path";
import * as fs from "fs";
import * as https from "https";

const csv = require('csv-parser')

const input_file_path = Path.join(__dirname, "..", "assets", "input.csv")
const temp_folder_path = Path.join(__dirname, "..", "assets", "temp")

const download = function (url, dest) {

    const promise = new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, function (response) {
            response.pipe(file);
            file.on('finish', function () {
                resolve(file.path)
            });
        }).on('error', function (err) { // Handle errors
            fs.unlink(dest, () => {
            }); // Delete the file async. (But we don't check the result)
            reject(err.message)
        });
    })

    return promise
};

const main = async () => {

    // Read data from CSV.
    const allData: any = await (new Promise((resolve, reject) => {
            const collector: any[] = []
            fs.createReadStream(input_file_path)
                .pipe(csv())
                .on('data', (row: any) => collector.push(row))
                .on('end', () => {
                    resolve(collector)
                })
        })
    )

    const data = [allData[0]]

    // Download all torrent files and convert to magnet links.
    for (const row of data) {
        const link = row["download_link_torrent-href"]
        console.log(await download(link, Path.join(temp_folder_path, "temp.torrent")))
    }

    // Save updates csv.
}


main().then(r => console.log("Started..."))