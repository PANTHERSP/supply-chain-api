const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const { v4: uuidv4 } = require('uuid');
const { format } = require('date-fns');
const { th } = require('date-fns/locale');

require('dotenv').config();

const PORT = process.env.PORT || 8000;
const mongoURI = process.env.MONGODB_URI;
const secretKey = process.env.SECRET_KEY;

const corsOptions = {
    origin: ['http://localhost:3000'],
    credentials: true
  };

const saltRounds = 12;

const userSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, required: true }
});

const productSchema = new mongoose.Schema({
    productName: { type: String, required: true },
    productCode: { type: String, required: true },
    productDescription: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    weight: { type: Number, required: true },
    farmName: { type: String, required: true },
    farmDetails: { type: String, required: true },
    latitude: { type: Number, required: true },
    longitude: { type: Number, required: true },
    plantingDate: { type: Date, required: true },
    expiryDate: { type: Date, required: true },
    universalId: { type: String, required: true },
    inStockDate: { type: String, required: true },
}, { timestamps: true });

  
app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

mongoose.connect(mongoURI)
    .then(() => {
        console.log('Connected to MongoDB')
        console.log('Connected to Database', mongoose.connection.name);
    })
    .catch((err) => console.log('Error connecting to MongoDB:', err));

app.get('/', (req, res) => {
    res.send('Hello, World!');
});

app.post('/sign-in', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const User = mongoose.model('User', userSchema);
        const user = await User.findOne({ username });

        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }

        const isPasswordValid = await bcrypt.compare(password, user.password);

        if (!isPasswordValid) {
            console.log('Invalid password');
            return res.status(401).json({ message: 'Invalid password' });
        }
        console.log("user", user);

        const token = jwt.sign({ username, role: user.role }, secretKey, { expiresIn: '1d' });
        res.cookie('token', token, {
             httpOnly: true,
             secure: true,
             sameSite: 'none',
             maxAge: 1000 * 60 * 60 * 24
        });
        console.log('User signed in successfully');
        res.status(200).json({ message: 'User signed in successfully', user: { username: user.username, role: user.role } });
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error' });
    }
})

app.post('/sign-out', (req, res) => {
    res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 0
    });
    console.log('User signed out successfully');
    res.status(200).json({ message: 'User signed out successfully' });
});

app.get('/check-session', (req, res) => {
    const token = req.headers.cookie?.split('=')[1];
    console.log(token);
    console.log(req.headers.cookie);

    if (!token) {
        console.log('No token found');
        return res.json({ auth: false });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        console.log('Token verified:', decoded);
        res.json({ auth: true, user: { username: decoded.username, role: decoded.role } });
        console.log('User is signed in');
    } catch (error) {
        console.error("Error verifying token:", error);
        res.json({ auth: false });
    }
});

app.post('/register', async (req, res) => {
    const { username, password, role } = req.body;
    console.log("register", req.body);
    try {
        const User = mongoose.model('User', userSchema);
        const isUserExist = await User.findOne({ username });

        if (isUserExist) {
            console.log('User already exists');
            return res.status(409).json({ message: 'User already exists', user: null });
        }

        const salt = await bcrypt.genSalt(saltRounds);
        const hashedPassword = await bcrypt.hash(password, salt);
        const user = new User({ username, password: hashedPassword, role });
        await user.save();
        console.log('User registered successfully,', user);
        res.status(201).json({ message: 'User registered successfully', user});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.post('/add-product', async (req, res) => {
    // const { productName, productCode, productDescription, price, quantity, weight, farmName, farmDetails, latitude, longitude, plantingDate, expiryDate } = req.body;
    console.log("add product", req.body);
    try {
        const Product = mongoose.model('Product', productSchema);
        const count = await Product.countDocuments();
        const product = new Product({ ...req.body, universalId: `${count + 1}`, inStockDate: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: th }) });
        await product.save();
        console.log('Product added successfully,', product);
        res.status(201).json({ message: 'Product added successfully', product});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.get('/get-all-products', async (req, res) => {
    try {
        const Product = mongoose.model('Product', productSchema);
        const products = await Product.find();
        console.log('Products fetched successfully,', products);
        res.status(200).json({ message: 'Products fetched successfully', products});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
