const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/test');
        console.log('Connected to MongoDB!');

        const db = mongoose.connection.db;
        
        // 1. Get unique sections from products
        const productsColl = db.collection('products');
        const uniqueSectionsInProducts = await productsColl.distinct('section');
        console.log('\nUnique section values in products:', uniqueSectionsInProducts);

        // 2. Get sections document
        const sectionsColl = db.collection('sections');
        const sectionDoc = await sectionsColl.findOne({});
        console.log('\nSections in section-doc:', sectionDoc ? sectionDoc.Section.map(s => ({ name: s.name, imgUrl: s.imgUrl })) : 'None');

        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}
run();
