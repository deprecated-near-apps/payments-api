const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const nacl = require('tweetnacl');
const nearAPI = require('near-api-js');
const getConfig = require('../src/config');
const { contractAccount, withNear, hasAccessKey } = require('./middleware/near');
const { contractName, accountSecret, networkId } = getConfig();
const {
    Account,
    KeyPair,
    utils: { PublicKey, serialize: { base_encode } }
} = nearAPI;

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());
app.use(withNear());

const getDeterministic = (a, b) => {
    const hash = crypto.createHash('sha256').update(accountSecret + a + b).digest();
    const keyPair = KeyPair.fromString(base_encode(nacl.sign.keyPair.fromSeed(hash).secretKey));
    const implicitAccountId = Buffer.from(PublicKey.from(keyPair.publicKey).data).toString('hex');

    return { keyPair, implicitAccountId }
}

app.post('/create-account', (req, res) => {
    const { name, eventName } = req.body
    /********************************
    !!!CHECK name, eventName are valid entries in your DATABASE!!!
    ********************************/
    const { implicitAccountId } = getDeterministic(name, eventName)
	res.json({ implicitAccountId, success: true });
});

app.post('/check-account', async (req, res) => {
    const { accountId } = req.body

    const account = new Account(req.near.connection, accountId)
    let state
    try {
        state = await account.state()
    } catch(e) {
        console.warn(e)
    }

	res.json({ state, success: true });
});


app.post('/deposit-account', async (req, res) => {
    const { name, eventName } = req.body

    const { keyPair, implicitAccountId } = getDeterministic(name, eventName)
    const account = new Account(req.near.connection, implicitAccountId)
    req.near.connection.signer.keyStore.setKey(networkId, implicitAccountId, keyPair);
    const result = await account.deleteAccount(contractName)

	res.json({ result, success: true });
});


app.get('/', (req, res) => {
	res.send('Hello World!');
});

app.post('/has-access-key', hasAccessKey, (req, res) => {
	res.json({ success: true });
});

// WARNING NO RESTRICTION ON THIS ENDPOINT
app.post('/add-key', async (req, res) => {
	const { publicKey } = req.body;
	try {
		const result = await contractAccount.addAccessKey(publicKey);
		res.json({ success: true, result });
	} catch(e) {
		return res.status(403).send({ error: `key is already added`});
	}
});

// WARNING NO RESTRICTION ON THIS ENDPOINT
app.get('/delete-access-keys', async (req, res) => {
	const accessKeys = (await contractAccount.getAccessKeys()).filter(({ access_key: { permission }}) => permission && permission.FunctionCall && permission.FunctionCall.receiver_id === contractName);
	try {
		const result = await Promise.all(accessKeys.map(async ({ public_key }) => await contractAccount.deleteKey(public_key)));
		res.json({ success: true, result });
	} catch(e) {
		return res.status(403).send({ error: e.message});
	}
});

app.listen(port, () => {
	console.log(`\nContract Account ID:\n${contractName}\nListening at http://localhost:${port}`);
});