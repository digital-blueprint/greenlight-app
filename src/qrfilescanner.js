import * as commonUtils from '@dbp-toolkit/common/utils';
import {name as pkgName} from './../package.json';
import pdfjs from 'pdfjs-dist/legacy/build/pdf.js';

class QrScanner {
    constructor() {
        this._engine = null;
        this._scanner = null;
    }

    async scanImage(image) {
        if (this._scanner === null)  {
            this._scanner = (await import('qr-scanner')).default;
            this._scanner.WORKER_PATH = commonUtils.getAssetURL(pkgName, 'qr-scanner-worker.min.js');
        }
        if (this._engine === null) {
            this._engine = await this._scanner.createQrEngine(this._scanner.WORKER_PATH);
        }
        try {
            return {data: await this._scanner.scanImage(image)};
        } catch (e) {
            return null;
        }
    }
}

/**
 * Returns the content of the file
 *
 * @param {File} file The file to read
 * @returns {string} The content
 */
const readBinaryFileContent = async (file) => {
    return new Promise((resolve, reject) => {
        let reader = new FileReader();
        reader.onload = () => {
            resolve(reader.result);
        };
        reader.onerror = () => {
            reject(reader.error);
        };
        reader.readAsBinaryString(file);
    });
};

async function getPage(pdf, pages, heights, width, height, currentPage, scale, canvasImages) {
    let page = await pdf.getPage(currentPage);
    let viewport = page.getViewport({scale});
    let canvas = document.createElement('canvas') , ctx = canvas.getContext('2d');
    let renderContext = { canvasContext: ctx, viewport: viewport };
    canvas.height = viewport.height;
    canvas.width = viewport.width;
    await page.render(renderContext).promise;
    console.log("page rendered");
    pages.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

    heights.push(height);
    height += canvas.height;
    if (width < canvas.width) width = canvas.width;

    if (currentPage < pdf.numPages) {
        currentPage++;
        await getPage(pdf, pages, heights, width, height, currentPage, scale, canvasImages);
    }
    else {
        let canvas = document.createElement('canvas'), ctx = canvas.getContext('2d');
        canvas.width = width;
        canvas.height = height;
        for(let i = 0; i < pages.length; i++)
            ctx.putImageData(pages[i], 0, heights[i]);
        canvasImages.push(canvas);
    }
}

/**
 * Converts a PDF file to an Canvas Image Array
 *
 * @param {File} file
 */
async function getImageFromPDF(file) {
    const data = await readBinaryFileContent(file);
    let pages = [], heights = [], width = 0, height = 0, currentPage = 1;
    let scale = 3;
    let canvasImages = [];
    try {
        let pdf = await pdfjs.getDocument({data: data}).promise;
        await getPage(pdf, pages, heights, width, height, currentPage, scale, canvasImages);
        return canvasImages;
    }
    catch (error) {
        //TODO Throw error if pdf cant converted to image
        console.error(error);
        return -1;
    }
}

async function getQRCodeFromPDF(file) {
    pdfjs.GlobalWorkerOptions.workerSrc = commonUtils.getAssetURL(pkgName, 'pdfjs/pdf.worker.js');
    let pages = await getImageFromPDF(file);
    let payload = null;
    let scanner = new QrScanner();
    for (const page of pages) {
        payload = await scanner.scanImage(page);
        if (payload !== null)
            break;
    }
    return payload;
}

async function getQRCodeFromImage(file) {
    let scanner = new QrScanner();
    return scanner.scanImage(file);
}

export async function getQRCodeFromFile(file)
{
    if (file.type === "application/pdf") {
        return await getQRCodeFromPDF(file);
    } else {
        return await getQRCodeFromImage(file);
    }
}