const express = require('express');
const cookieParser = require('cookie-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const app = express();
const { v4: uuidv4 } = require('uuid');
const { format, add } = require('date-fns');
const { th, pl } = require('date-fns/locale');
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");

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
    isAdmin: { type: Boolean, default: false },
    wallet: { type: Object, required: true },
    profileImage: { type: String, required: false },
    // role: { type: String, required: true }
});

const dealSchema = new mongoose.Schema({
    dealId: { type: String, required: true, unique: true },
    dealName: { type: String, required: true },
    dealStatus: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: false },
    participants: { type: Array, required: true },
    products: { type: Array, required: true },
});

// const cycleSchema = new mongoose.Schema({
//     cycleId: { type: String, required: true, unique: true },
//     dealId: { type: String, required: true },
//     currentOwner: { type: String, required: true },
// });

// const TransactionSchema = new mongoose.Schema({
//     transactionId: { type: String, required: true, unique: true },
//     cycleId: { type: String, required: true },
//     amount: { type: Number, required: true },
//     transactionDate: { type: Date, required: true },
// });

const productSchema = new mongoose.Schema({
    dealId: { type: String, required: true },
    status: { type: String, required: true },
    productName: { type: String, required: true },
    productCode: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    grade: { type: String, required: true },
    farmName: { type: String, required: true },
    plantingDate: { type: String, required: true },
    expiryDate: { type: String, required: true },
    imageUrl: { type: String, required: true },
    productId: { type: String, required: true, unique: true },
    inStockDate: { type: String, required: true },
}, { timestamps: true });

const s3 = new S3Client(
    {
        region: process.env.AWS_REGION,
        credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
        }
    }
);

  
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

        const token = jwt.sign({ username }, secretKey, { expiresIn: '1d' });
        res.cookie('token', token, {
             httpOnly: true,
             secure: true,
             sameSite: 'none',
             maxAge: 1000 * 60 * 60 * 24
        });
        console.log('User signed in successfully');
        res.status(200).json({ message: 'User signed in successfully', user });
        
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

app.get('/check-session', async (req, res) => {
    const cookie = req.headers.cookie;
    console.log("cookie", cookie);
    const tokenn = req.headers.cookie.split(' ').pop()
    const token = tokenn.split('=')[1];
    console.log("token", token);

    if (!token) {
        console.log('No token found');
        return res.json({ auth: false });
    }

    try {
        const decoded = jwt.verify(token, secretKey);
        console.log('Token verified:', decoded);
        const User = mongoose.model('User', userSchema);
        const user = await User.findOne({ username: decoded.username });
        if (!user) {
            console.log('User not found');
            return res.json({ auth: false });
        }
        res.json({ auth: true, user });
        console.log('User is signed in');
    } catch (error) {
        console.error("Error verifying token:", error);
        res.json({ auth: false });
    }
});

app.post('/register', async (req, res) => {
    const { username, password } = req.body;
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
        const user = new User({ username, password: hashedPassword, isAdmin: false, wallet: { address: '', balance: 0 }, profileImage: '' });
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
    const { plantingDate, expiryDate } = req.body;
    console.log("add product", req.body);
    try {
        const Product = mongoose.model('Product', productSchema);
        const count = await Product.countDocuments();
        const product = new Product({ ...req.body, productId: `${count + 1}`, status: 'farmer add product', plantingDate: format(new Date(plantingDate), 'dd/MM/yyyy HH:mm', { locale: th }), expiryDate: format(new Date(expiryDate), 'dd/MM/yyyy HH:mm', { locale: th }), inStockDate: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: th }) });
        await product.save();
        console.log('Product added successfully,', product);
        res.status(201).json({ message: 'Product added successfully', product});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.post('/update-product-status', async (req, res) => {
    const { productId, status } = req.body;
    console.log("update product status", req.body);
    try {
        const Product = mongoose.model('Product', productSchema);
        const product = await Product.findOne({ productId: productId });
        if (!product) {
            console.log('Product not found');
            return res.status(404).json({ message: 'Product not found' });
        }
        product.status = status;
        await product.save();
        console.log('Product status updated successfully', product);
        res.status(200).json({ message: 'Product status updated successfully', product});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.get('/products', async (req, res) => {
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

app.post("/get-presigned-url", async (req, res) => {
    const { fileName, fileType, folder } = req.body;
    const timestamp = Date.now();
    const key = `uploads/${folder}/${timestamp}-${fileName}`;

    const params = {
        Bucket: "supply-chain-blockchain",
        Key: key,
        ContentType: fileType,
    };

    const uploadUrl = await getSignedUrl(s3, new PutObjectCommand(params));
    res.json({ uploadUrl, fileUrl: `https://supply-chain-blockchain.s3.ap-southeast-1.amazonaws.com/${key}` });
});


app.get('/deals', async (req, res) => {
    try {
        const Deal = mongoose.model('Deal', dealSchema);
        const deals = await Deal.find();
        console.log('Deals fetched successfully,', deals);
        res.status(200).json({ message: 'Deals fetched successfully', deals});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.post('/create-deal', async (req, res) => {

    const { participants, dealName } = req.body;

    console.log("create deal", req.body);

    try {
        const User = mongoose.model('User', userSchema);
        const Deal = mongoose.model('Deal', dealSchema);

        const usernames = participants.map(participant => participant.username);
        const users = await User.find({ username: { $in: usernames } });
        console.log("users", users);
        console.log("usernames", usernames);
        if (users.length !== usernames.length) {
            console.log('Some participants are not found in the database or duplicate usernames found');
            return res.status(404).json({ message: 'Some participants are not found in the database or duplicate usernames found' });
        }

        // const isAnyParticipantDoesNotHaveWalletAddress = users.some(user => !user.wallet.address);
        // if (isAnyParticipantDoesNotHaveWalletAddress) {
        //     console.log('Some participants do not have wallet addresses');
        //     return res.status(404).json({ message: 'Some participants do not have wallet addresses' });
        // }

        // const duplicateUsernames = users.filter((user, index, self) => 
        //     index !== self.findIndex((u) => u.username === user.username)
        // ).map(user => user.username);

        // if (duplicateUsernames.length > 0) {
        //     console.log('Duplicate usernames found:', duplicateUsernames);
        //     return res.status(409).json({ message: 'Duplicate usernames found', duplicateUsernames });
        // }

        const count = await Deal.countDocuments();
        const deal = new Deal({
            dealId: `${count + 1}`,
            products: [],
            dealStatus: 'active',
            startDate: format(new Date(), 'dd/MM/yyyy HH:mm', { locale: th }),
            endDate: '',
            participants,
            dealName
        });
        await deal.save();
        console.log('Deal added successfully,', deal);
        res.status(201).json({ message: 'Deal added successfully', deal});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.post('/update-settings', async (req, res) => {

    const { username, profileImage, walletAddress } = req.body;

    try {
        const User = mongoose.model('User', userSchema);
        const user = await User.findOneAndUpdate(
            { username: username },
            {
                profileImage: profileImage,
                'wallet.address': walletAddress
            },
            { new: true }
        );
        if (!user) {
            console.log('User not found');
            return res.status(404).json({ message: 'User not found' });
        }
        console.log('User settings updated successfully', user);
        res.status(200).json({ message: 'User settings updated successfully', user});
        
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
