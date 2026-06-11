const mongoose = require('mongoose');
require('dotenv').config();

function searchObj(obj, query) {
    if (!obj) return false;
    if (typeof obj === 'string') {
        return obj.toLowerCase().includes(query.toLowerCase());
    }
    if (Array.isArray(obj)) {
        return obj.some(item => searchObj(item, query));
    }
    if (typeof obj === 'object') {
        return Object.values(obj).some(val => searchObj(val, query));
    }
    return false;
}

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test');
        console.log('Connected to MongoDB!');

        const db = mongoose.connection.db;
        const collections = await db.listCollections().toArray();

        for (const colInfo of collections) {
            const name = colInfo.name;
            const coll = db.collection(name);
            const docs = await coll.find({}).toArray();
            
            const matches = docs.filter(doc => searchObj(doc, 'Tủ'));
            if (matches.length > 0) {
                console.log(`\nFound ${matches.length} matching documents in collection: ${name}`);
                console.log('Sample matching document:');
                console.log(JSON.stringify(matches[0], null, 2));
            }
        }

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
