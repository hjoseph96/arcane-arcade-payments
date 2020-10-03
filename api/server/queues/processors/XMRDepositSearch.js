require('dotenv').config();

import database from '../../src/models';
import WalletService from '../../services/WalletService';
import MoneroService from '../../services/MoneroService';
import CryptoConversion from '../../utils/CryptoConversion';
import MoneroAddressService from '../../services/MoneroAddressService';
import XMRTransactionService from '../../services/XMRTransactionService';


const process = async (job) => {
    console.log('****** SCANNING XMR DEPOSITS ******');

    let currentPercentage = 0.00;
    const addresses = await database.MoneroAddress.findAll({
        where: { active: true }
    });

    const calcNibiruFee = async (coinAmount) => {
        // Convert to USD
        const converter = new CryptoConversion({
            to_currency: 'USD',
            amount: coinAmount,
            from_currency: 'XMR'
        })
        const amountPaidUSD = await converter.convert();

        // 5% of deposit in XMR
        let nibiruFee = Number((amountPaidUSD * 0.05).toFixed(2));
        converter.reset({
            amount: nibiruFee,
            from_currency: 'USD',
            to_currency: 'XMR'
        });

        nibiruFee = await converter.convert();

        return nibiruFee;
    }


    for (let i = 0; i < addresses.length; i++) {
        const percentage = parseFloat((i + 1)) / addresses.length;
        currentPercentage =  Number((percentage).toFixed(2)) * 100;

        const currentAddress = addresses[i];
        // Skip primary address
        if (currentAddress.subaddressIndex == 0) continue;

        console.log(`********* CHECKING ADDRESS: ${currentAddress.address} *********`);

        const utXOs = await MoneroService.getUnspents(currentAddress.subaddressIndex);
        if (utXOs.length == 0) {
            console.log(`No unspent transactions found for: ${currentAddress.address}`)

            job.progress(currentPercentage);
        } else {
            const unlockedBalance = await MoneroService.getBalance(currentAddress.subaddressIndex);
            const asXMR = (unlockedBalance / 1000000000000).toFixed(12);

            const currentBalance = parseInt(currentAddress.balance);
            console.log(`****** Balance: ${currentBalance} ******`);

            if (unlockedBalance > currentBalance) {
                console.log('\n\n\n\n\n\n==============================================================================================================================');
                console.log(`| Found ${utXOs.length} unspent transactions, worth: ${asXMR} XMR for address: ${currentAddress.address} |`);
                console.log('================================================================================================================================\n\n\n\n\n');

                const depositAsXMR = (currentAddress.deposit_amount / 1000000000000).toFixed(12);
                console.log(`AS XMR: ${asXMR}`);
                console.log(`DEPOSIT AMOUNT AS XMR: ${depositAsXMR}`);
                console.log(`UNLOCKED BALANCE: ${unlockedBalance}`);
                console.log(`DEPOSIT AMOUNT: ${unlockedBalance}`);

                if (unlockedBalance == currentAddress.deposit_amount) {
                    await MoneroAddressService.updateAddress(currentAddress.id, {
                        active: false,
                        balance: unlockedBalance
                    });

                } else {
                    console.log('Invalid deposit amount received...');

                    // Send back? or request difference. probably send back.
                }
            }
        }

        job.progress(currentPercentage);
    }
};

module.exports = process;
