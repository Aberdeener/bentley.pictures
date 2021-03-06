const express = require('express');
const app = express();
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const serviceAccount = require('./firebase-creds.json');

initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore();

app.get('/', async (req, res) => {
    res.sendFile(getRandomImagePath(), (err) => {
        if (err) {
            res.status(err.status).end();
        }
    });
    await incrementSiteVisits('/');
});

app.get('/:id', async (req, res) => {
    const image = getImageById(req.params.id);
    if (image) {
        res.sendFile(image, (err) => {
            if (err) {
                res.status(err.status).end();
            }
        });
        await incrementImageViews(req.params.id);
    } else {
        res.json({
            error: 'Image not found'
        });
    }
    await incrementSiteVisits(`/${req.params.id}`);
});

app.get('/api/stats', async (req, res) => {
    const data = await db.collection('image_stats').orderBy('views', 'desc').get();
    res.json(data.docs.map(doc => {
        return {
            id: doc.id,
            views: doc.data().views
        };
    }));
    await incrementSiteVisits('/api/stats');
});

app.get('/api/list', async (req, res) => {
   res.json(getAllImageIds());
    await incrementSiteVisits('/api/list');
});

app.get('/api/random', async (req, res) => {
    res.json(getRandomImageApi());
    await incrementSiteVisits('/api/random');
});

app.get('/api/:id', async (req, res) => {
    const image = getImageById(req.params.id, false);
    if (image) {
        res.json({
            id: parseInt(req.params.id),
            url: 'https://bentley.tadhg.sh/' + image.substring(8),
        });
    } else {
        res.json({
            error: 'Image not found'
        });
    }
    await incrementSiteVisits(`/api/${req.params.id}`);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log('App listening at http://localhost:' + port);
});

const getRandomImagePath = () => {
    const images = fs.readdirSync('./images');
    return  __dirname + '/images/' + images[Math.floor(Math.random() * images.length)];
};

const getImageById = (id, path = true) => {
    const images = fs.readdirSync('./images');
    for (const image of images) {
        if (image === '.DS_Store') {
            continue;
        }
        if (image === 'bentley-' + id || image.substring(8, image.length - 4) === id) {
            if (path) {
                return __dirname + '/images/' + image;
            } else {
                return image;
            }
        }
    }

    return null;
};

const getAllImageIds = () => {
    const ids = [];

    fs.readdirSync('./images').forEach(image => {
        if (image !== '.DS_Store') {
            ids.push(image.substring(8, image.length - 4));
        }
    });

    return ids.sort((a, b) => a - b);
};

const getRandomImageApi = () => {
    const path = getRandomImagePath();
    const id = path.split('-')[1];
    return {
        id: parseInt(id),
        url: 'https://bentley.tadhg.sh/' + id,
    };
};

const incrementImageViews = async (id) => {
    const docRef = db.collection('image_stats').doc(id.split('.')[0]);
    const doc = await docRef.get();
    if (doc.exists) {
        await docRef.update({
            views: FieldValue.increment(1)
        });
    } else {
        await docRef.set({
            views: 1
        });
    }
};

const incrementSiteVisits = async (path) => {
    const docRef = db.collection('site_visits').doc(`path-${path}`);
    const doc = await docRef.get();
    if (doc.exists) {
        await docRef.update({
            visits: FieldValue.increment(1)
        });
    } else {
        await docRef.set({
            visits: 1
        });
    }
}
