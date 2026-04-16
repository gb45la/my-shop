const express = require('express');
const bcrypt = require('bcrypt');
const sqlite3 = require('sqlite3');
const { open } = require('sqlite');

const app = express();
app.use(express.json());

let db; 
async function initDB() {
    db = await open({ filename: './database.sqlite', driver: sqlite3.Database });
    
    // 建立客戶資料表 (之前寫好的)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL
        )
    `);

    // 【新增】建立商品資料表 (Products)
    await db.exec(`
        CREATE TABLE IF NOT EXISTS Products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price INTEGER NOT NULL,
            image_url TEXT
        )
    `);
    console.log('✅ SQL 資料庫準備就緒 (包含 Users 與 Products 資料表)。');
}
initDB();

// --- 網頁路線 ---
app.get('/', (req, res) => res.sendFile(__dirname + '/index.html'));
app.get('/login', (req, res) => res.sendFile(__dirname + '/login.html'));

// 【新增】後台管理網頁路線 (http://localhost:3000/admin)
app.get('/admin', (req, res) => res.sendFile(__dirname + '/admin.html'));

// --- 客戶 API (註冊與登入) ---
app.post('/api/register', async (req, res) => {
    const { username, email, password } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: '請填寫所有的註冊欄位！' });

    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        await db.run('INSERT INTO Users (username, email, password) VALUES (?, ?, ?)', [username, email, hashedPassword]);
        res.status(201).json({ message: '註冊成功！' });
    } catch (error) {
        if (error.message.includes('UNIQUE')) return res.status(409).json({ error: '這個 Email 已經被註冊過囉！' });
        res.status(500).json({ error: '註冊失敗' });
    }
});

app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: '請填寫 Email 和密碼！' });

    try {
        const user = await db.get('SELECT * FROM Users WHERE email = ?', [email]);
        if (user && await bcrypt.compare(password, user.password)) {
            res.status(200).json({ message: '登入成功！' });
        } else res.status(401).json({ error: '密碼或帳號錯誤！' });
    } catch (error) { res.status(500).json({ error: '伺服器錯誤' }); }
});

// --- 【新增】商品 API (上架功能) ---
app.post('/api/products', async (req, res) => {
    const { name, price, imageUrl } = req.body;
    
    if (!name || !price) {
        return res.status(400).json({ error: '必須填寫商品名稱和價格！' });
    }

    try {
        // 將商品存入 SQL 資料庫
        await db.run(
            'INSERT INTO Products (name, price, image_url) VALUES (?, ?, ?)', 
            [name, price, imageUrl]
        );
        console.log(`📦 新商品上架成功：${name} (NT$ ${price})`);
        res.status(201).json({ message: '商品上架成功！' });
    } catch (error) {
        res.status(500).json({ error: '寫入資料庫失敗' });
    }
});
// --- 【新增】商品 API (讓首頁讀取所有商品) ---
app.get('/api/products', async (req, res) => {
    try {
        // 從 Products 資料表抓出所有商品資料
        const products = await db.all('SELECT * FROM Products');
        res.status(200).json(products);
    } catch (error) {
        res.status(500).json({ error: '無法讀取商品資料' });
    }
});
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`🚀 伺服器啟動！請前往 http://localhost:${PORT}`);
});