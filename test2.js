const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const fs = require("fs");

const s3 = new S3Client();

async function uploadFile() {
    const fileStream = fs.createReadStream("downloaded-file.txt");

    const params = {
        Bucket: "supply-chain-blockchain",
        Key: "uploads/test-file.txt",
        Body: fileStream,
        ContentType: "text/plain",
    };

    await s3.send(new PutObjectCommand(params));
    console.log("File uploaded successfully!");
}

uploadFile();
