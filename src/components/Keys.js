import React, { useState, useEffect } from 'react';
import * as nearAPI from 'near-api-js';
import { get, set, del } from '../utils/storage';
import { generateSeedPhrase } from 'near-seed-phrase';
import { 
	contractName,
	createAccessKeyAccount,
	postJson,
	postSignedJson
} from '../utils/near-utils';

const LOCAL_KEYS = '__LOCAL_KEYS';

const {
	KeyPair,
	utils: { PublicKey, format: { formatNearAmount } }
} = nearAPI;

export const Keys = ({ update }) => {
    const [name, setName] = useState('matt')
    const [eventName, setEventName] = useState('tournamentX')
    const [implicitAccountId, setImplicitAccountId] = useState('')
    const [state, setState] = useState()
    const [fundState, setFundState] = useState()

    const handleCreateAccount = async () => {
        const result = await postJson({
            url: 'http://localhost:3000/create-account',
            data: {
                name, eventName
            }
        })

        if (result && result.success) {
            setImplicitAccountId(result.implicitAccountId)
        }
    }

    const handleCheckAccount = async (accountId, callback) => {

        const result = await postJson({
            url: 'http://localhost:3000/check-account',
            data: {
                accountId
            }
        })
        if (result && result.success) {
            callback(result.state || { amount: '0'})
        }
    }
    
    const handleDeposit = async () => {
        const result = await postJson({
            url: 'http://localhost:3000/deposit-account',
            data: {
                name, eventName
            }
        })

        if (result && result.success) {
            console.log(result)
            handleCheckAccount(implicitAccountId, setState)
            handleCheckAccount(contractName, setFundState)
        }
    }

	return <>
		<h3>Make a Deposit to Attend</h3>
        <input placeholder="Username" value={name} onChange={(e) => setName(e.target.value)} />
        <br />
        <input placeholder="Event Name" value={eventName} onChange={(e) => setEventName(e.target.value)} />
        <br />
        <button onClick={() => handleCreateAccount()}>Create Account</button>
        <br />
        <br />
        <h3>Deposit Address</h3>

        <p>{implicitAccountId}</p>
        <p>Balance: { state ? formatNearAmount(state.amount, 2) : '0'}</p>
        <br />
        <button onClick={() => handleCheckAccount(implicitAccountId, setState)}>Check Account</button>
        
        <h3>Make Tournament Deposit</h3>
        <br />
        <button onClick={() => handleDeposit()}>Make Deposit</button>


        <h3>Tournament Funds Raised</h3>
        <p>{contractName}</p>
        <p>Balance: { fundState ? formatNearAmount(fundState.amount, 2) : '0'}</p>
        <br />
        <button onClick={() => handleCheckAccount(contractName, setFundState)}>Refresh Funds</button>

	</>;
};

