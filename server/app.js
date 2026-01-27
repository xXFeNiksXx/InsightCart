const express = require('express');
const app = express();
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser');
const puppeteer = require('puppeteer-extra');
const telegramBot = require('node-telegram-bot-api');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
const cheerio = require('cheerio');
const axios = require('axios');
const mongoose = require('mongoose');
const cron = require('node-cron');

const dotenv = require('dotenv').config();
const PORT = process.env.PORT || 5001;
const TOKEN = process.env.TOKEN;
const CHAT_ID = process.env.CHAT_ID;


mongoose.connect(process.env.MONGODB_URL)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.error('MongoDB connection error:', err));

    const itemSchema = new mongoose.Schema({
        title: String,
        price: String,
        status: Boolean,
        image: String, 
        createdAt: { type: Date, default: Date.now },
        follow: Boolean,
        url: { type: String, unique: true },
        categoryUrl: String
    });
    

const Item = mongoose.model('Item', itemSchema);

app.use(express.static(path.join(__dirname, 'public')));
app.use(cors());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
puppeteer.use(StealthPlugin());
const bot = new telegramBot(TOKEN, { polling: true });

async function addItem(url) {
    let browser;
    try {
        browser = await puppeteer.launch({ 
            headless: "new",
            args: ['--no-sandbox', '--disable-setuid-sandbox'] 
        });
        const page = await browser.newPage();

        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        const html = await page.content();
        const $ = cheerio.load(html);

        const categoryUrl = $('[data-testid="crumb_item"] a').last().attr('href') || "";
        const title = $('.title__font').first().text().trim();
        const price = $('.product-price__big').first().text().trim();
        const statusText = $('.status-label').text();
        const status = statusText.includes('Є в наявності') || statusText.includes('Закінчується');
        const image = $('.main-slider__item img').first().attr('src');

        return { title, price, status, image, categoryUrl, url };
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// post

app.post('/addNewItem', async (req, res) => {
    const { URL } = req.body;
    if (!URL) return res.status(400).json({ message: 'URL is required' });

    try {
        const itemInfo = await addItem(URL);
        const newItem = await Item.create({ ...itemInfo, follow: false });
        res.json({ message: 'Data successfully logged', itemInfo: newItem });
    } catch (error) {
        console.error('Error adding item:', error);
        res.status(500).json({ message: 'Error fetching data from URL' });
    }
});

app.post('/updateItem', async (req, res) => {
    const { url } = req.body;
    try {
        const newData = await addItem(url);
        const oldItem = await Item.findOne({ url });

        if (!oldItem) return res.status(404).json({ message: 'Item not found' });

        const hasChanged = oldItem.price !== newData.price || oldItem.status !== newData.status;

        if (!hasChanged) {
            return res.json({ message: 'The data has not changed' });
        }

        await Item.updateOne({ url }, newData);
        res.json({ message: 'The data has changed', updatedItem: newData });
    } catch (error) {
        console.error('Error updating item:', error);
        res.status(500).json({ message: 'Error updating item' });
    }
});

// get
app.get('/items', async (req, res) => {
    try {
        const items = await Item.find();
        res.json(items);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching items' });
    }
});

app.get('/recomendations/:id', async (req, res) => {
    const { id } = req.params;
    const pageNum = req.query.page || 1;
    let browser;

    try {
        const item = await Item.findById(id);
        if (!item || !item.categoryUrl) return res.status(404).json({ message: "Category URL not found" });

        const targetUrl = `${item.categoryUrl.replace(/\/$/, '')}/page=${pageNum}/`;
        
        browser = await puppeteer.launch({ headless: "new" });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
        
        await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 60000 });
        
        const html = await page.content();
        const $ = cheerio.load(html);
        const recommendations = [];

        $('rz-catalog-goods .item').each((i, element) => {
            const title = $(element).find('.tile-title').text().trim();
            const priceText = $(element).find('.price').first().text();
            const price = priceText.replace(/[^0-9]/g, '');
            
            const image = $(element).find('img.tile-image').attr('src');
            const url = $(element).find('a.tile-image-host').attr('href');
            const hasBuyButton = $(element).find('.buy-button').length > 0;
            const statusText = $(element).text().toLowerCase();
            
            if (title && price) {
                recommendations.push({
                    title,
                    priceText,
                    image,
                    url,
                    status: hasBuyButton || statusText.includes('є в наявності')
                });
            }
        });
        console.log(`Page ${pageNum}: Found ${recommendations.length} items`);
        
        res.json(recommendations);
    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ message: 'Error fetching recommendations' });
    } finally {
        if (browser) await browser.close();
    }
});

// delete
app.delete('/deleteItem/:id', async (req, res) => {
    try {
        await Item.findByIdAndDelete(req.params.id);
        res.json({ message: 'Item deleted' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting item' });
    }
});

// cron
cron.schedule('0 2 * * *', async () => {
    console.log('Update started');
    const items = await Item.find();
    let message = `📊 <b>Щоденне оновлення товарів: </b>\n\n`;
    if (items.length === 0) {
        return;
    } else {
    for (const item of items) {
        try {
            message += `📌 <b>${item.title}\n\n</b>`;
            message += `💰 ${item.price}\n\n`;
            if (item.status == true) {
                message += `🟢 ${item.status}\n\n`;
            }else{
                message += `🔴 ${item.status}\n\n`;
            }
            message += `🔗 ${item.url}\n\n\n`;
            const newData = await addItem(item.url);
            await Item.updateOne({ _id: item._id }, newData);
            console.log(`Updated: ${item.title}`);
            await new Promise(r => setTimeout(r, 10000));
        } catch (err) {
            console.error(`Failed to update: ${item.url}`);
        }
    }
    bot.sendMessage(CHAT_ID, message, { 
        parse_mode: 'HTML',
        disable_web_page_preview: true 
    });
    console.log('Update finished');
}
});

// listen
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});