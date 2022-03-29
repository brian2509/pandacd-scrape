import * as Path from "path";
import * as fs from "fs";
import axios, {AxiosResponse} from "axios";

const csv = require('csv-parser')
const parseTorrent = require('parse-torrent')
const ObjectsToCsv = require('objects-to-csv')

const input_file_path = Path.join(__dirname, "..", "assets", "input.csv")
const temp_folder_path = Path.join(__dirname, "..", "assets", "cache")
const output_filepath = Path.join(__dirname, "..", "assets", "output.csv")

const filenameFromResponse = (response: AxiosResponse) => {

    let headerLine = response.data.headers['content-disposition'];
    if (headerLine === undefined) {
        throw Error()
    }
    let startFileNameIndex = headerLine.indexOf('"') + 1
    let endFileNameIndex = headerLine.lastIndexOf('"');
    return headerLine.substring(startFileNameIndex, endFileNameIndex);
}

export async function downloadFile(fileUrl: string, outputLocationPath: string): Promise<string> {
    return axios({
        method: 'get',
        url: fileUrl,
        responseType: 'stream',
    }).then(response => {
        return new Promise((resolve, reject) => {
            const path = Path.join(outputLocationPath, filenameFromResponse(response))
            console.log(`Saving file to ${path}`)

            // Skip if .torrent file exists.
            if (fs.existsSync(path)) {
                console.log(`Not downloading, exists.`)
                resolve(path)
            }
            const writer = fs.createWriteStream(path);
            response.data.pipe(writer);

            let error = null;
            writer.on('error', err => {
                error = err;
                writer.close();
                reject(err);
            });
            writer.on('close', () => {
                if (!error) {
                    resolve(path);
                }
            });
        });
    });
}

// Change this if needed.
type InputRow = {
    "download_link-href": string,
    artist: string
    title: string,
}

type OutputRow = {
    title: string,
    artist: string,
    magnet: string
}

const main = async () => {

    // Output init.
    const output: OutputRow[] = []

    // Read data from CSV.
    const allData: InputRow[] = await (new Promise((resolve, _) => {
            const collector: any[] = []
            fs.createReadStream(input_file_path)
                .pipe(csv())
                .on('data', (row: any) => collector.push(row))
                .on('end', () => {
                    resolve(collector)
                })
        })
    )

    // Download all torrent files and convert to magnet links.
    for (const row of allData) {
        try {
            const path = await downloadFile(row["download_link-href"], temp_folder_path)
            const torrent = parseTorrent(fs.readFileSync(path))
            const magnet = parseTorrent.toMagnetURI(torrent)

            output.push({
                title: row.title,
                artist: row.artist,
                magnet: magnet
            })
        } catch (e) {
            console.log(`Failed to process torrent ${row["download_link-href"]}`)
            console.log(e)
        }
    }

    const csvWriter = new ObjectsToCsv(output)
    await csvWriter.toDisk(output_filepath)
    console.log("Finished.")

}

main().then(_ => console.log("Started..."))

