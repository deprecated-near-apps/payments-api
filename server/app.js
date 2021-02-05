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

    /********************************
    Store `result.transaction.hash` for records, combined with name, eventName in your DATABASE

    Later using RPC you can determine value
    Using httpie example:

    http post https://rpc.testnet.near.org jsonrpc=2.0 id=dontcare method=EXPERIMENTAL_tx_status params:='["4emkqTHfuqfbkZdgChQhXoNZyB4ZXSqNaKtyxa8TpB1p", "dev-1612494521961-7654170"]'

    yields:
    {
        "id": "dontcare",
        "jsonrpc": "2.0",
        "result": {
            "receipts": [
                {
                    "predecessor_id": "system",
                    "receipt": {
                        "Action": {
                            "actions": [
                                {
                                    "Transfer": {
                                        "deposit": "999948890300000000000000"
                                    }
                                }
                            ],
                            ...
                        }
                    },
                    "receipt_id": "8j2fGRHyhb9td1wMCbBPqU6PrXPGGsy1WUYzgGpTiciK",
                    "receiver_id": "dev-1612494521961-7654170"
                }
            ],
            "receipts_outcome": [
                {
                    "block_hash": "aqrKPQVmEfbiYRrvFaL9nX6mMusyo45Lztfg7rz5xjv",
                    "id": "4D1Qwavzk7249RBqRsgn3DNAFh9Gt94UCs7iLQGMnx8r",
                    "outcome": {
                        "executor_id": "5560d92d22d189e4f25d75d60b189aa7a4ab2e4ac2558c7edc33501d67897e09",
                        ...
                    },
                    ...
                },
                ...
            ],
            ...
        },
        ...
    }
    ********************************/

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