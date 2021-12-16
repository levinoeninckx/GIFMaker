import aws = require('aws-sdk');
import express = require('express');
import axios from 'axios';
import { v4 } from 'uuid';
import cookieParser from 'cookie-parser'
import jwt from 'jsonwebtoken';

aws.config.update(
    {
        accessKeyId: "ASIAVUZ3GXGTVGJVKWWB",
        secretAccessKey: "pMatxY2IDnx6Cu/foWdI1vkipvc0u4is9ATXB6n0",
        region: "us-east-1",
        signatureVersion: "v4",
        sessionToken: "FwoGZXIvYXdzELL//////////wEaDE1YJ3HGBSGM77+AFyLLAY0laUUCtg/9mnQAnOPlTXAM8xfUl6ecDVAUtbSCN0YLP6HkAJAiSSS9FHUN5G7hjfF/wNi9eS9TX5T/28Q6dw5vZdzIBxbEjSdpffN9+Eb43mbGVhKL6ggEEmXqa3d1+pZEB6gFEr8bn6hYXOwv1C8AK1OuV4qgXeA7eHnq6UNrnAxytuNhsFp09/WNPbpViX23B1dLyXpRQpBLzXPxZwW1/gKm4a43Y5Sfimq3fw3CHalq6IqKOkuGa15P3v8DZZo5pcnlSZs/0NJtKOiB7I0GMi00VHXi0lu3woEGQsZxpD7iFUwwJKKM7XoC2Y398G8/eRkrKm1SQY5JLWlX3Uk="
    }
)

const s3 = new aws.S3();
const bucketName = 'gifmaker-test-robbe'

let app = express()
app.use(express.json())
app.use(cookieParser())

app.get("/api/hello", (req, res) => {
    res.json("Hello world!");
});

app.post("/api/exchange-code", (req, res) => {

    const { code } = req.body;
    const grant_type = "authorization_code";
    const client_id = "2fd7u0fag5vsa4hgdlkefsifde"
    const redirect_uri = "http://localhost:4000/gifmaker"
    const client_secret = "1t8q0alve7mknh2ubcvqj8febsmhv6agpg0tb7t14m4t225dop68"

    const params = new URLSearchParams({ grant_type, client_id, redirect_uri, code })

    axios.post("https://gifmaker.auth.us-east-1.amazoncognito.com/oauth2/token",
        params.toString(),
        {
            headers: {
                //VERY IMPORTANT. Not mentioned in tutorial from school
                ContentType: "application/x-www-form-urlencoded"
            },
            auth: {
                username: client_id,
                password: client_secret
            }
        }).then(result => {
            //Get unique user ID (sub) from id_token jwt
            let sub = jwt.decode(result.data.id_token).sub
            console.log(sub)

            res.cookie('loggedIn', true)
            res.cookie('id_token', result.data.id_token, { httpOnly: true })
            res.json(result.data)
        }).catch(err => {

            res.status(500).json(err)
        })
})

app.get('/api/imageurl', (req, res) => {

    if (!req.cookies) {
        respondUnauthorized(res)
    }

    else if (!req.cookies.id_token) {
        respondUnauthorized(res)
    }

    else {

        const objectId = v4();
        console.log("Return upload url with objectid: ", objectId)
        const generatedUrl = generatePutUrl(objectId, 'image/jpg');
        res.json(generatedUrl);
    }
})

app.post('/api/signaluploadcompleted', (req, res) => {

    if (!req.cookies) {
        respondUnauthorized(res)
    }

    else if (!req.cookies.id_token) {
        respondUnauthorized(res)
    }

    else {

        const { uploadUrls } = req.body;

        const objectIds = uploadUrls.map(uploadurls => extractObjectId(uploadurls));

        const inputImageUrls = objectIds.map(id => generateGetUrl(id));

        inputImageUrls.forEach(url => {
            console.log(url)
        });

        const outputObjectId = v4();
        console.log('Output id: ', outputObjectId);

        const outputImageUrl = generatePutUrl(outputObjectId, 'image/gif');


        axios.post('https://msw31oj97f.execute-api.eu-west-1.amazonaws.com/Prod/generate/gif', {
            inputImageUrls,
            outputImageUrl
        },
            {
                headers: {
                    'x-api-key': 'SIdHi3lzwma61h4GeBGR96ZD4rpsa3mb6iKVlMG7'//haal api key van postman file van lector
                }
            })
            .then(function (response) {

                //WRITE TO DB
                

                const gifUrl = generateGetUrl(outputObjectId);
                res.json(gifUrl);
            })
            .catch(function (error) {
                res.status(500).json(error);
            });
    }


})


function respondUnauthorized(res) {
    res.status(401).json()
}


function generateGetUrl(objectId) {
    return s3.getSignedUrl("getObject", {
        Key: objectId,
        Bucket: bucketName,
        Expires: 900
    })
}

function generatePutUrl(objectId, contentType) {
    return s3.getSignedUrl("putObject", {
        Key: objectId,
        Bucket: bucketName,
        Expires: 900,
        ContentType: contentType
    })
}

function extractObjectId(url) {
    const urlZonderMark = url.split("?")[0];
    const splitUrlSlashes = urlZonderMark.split('/');
    return splitUrlSlashes[splitUrlSlashes.length - 1];
}

app.listen(3000);