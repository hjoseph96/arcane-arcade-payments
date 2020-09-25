import axios from 'axios';


export default class CryptoConversion {
    constructor({amount, from_currency, to_currency}) {
        this.fromCurrency = from_currency || 'USD';
        
        if (!amount || !to_currency) throw new Error('You must pass `amount` and `to_currency` in the arguments.');

        this.amount = amount;
        this.toCurrency = to_currency;
    }

    convert() {
        let conversionAPIUrl = 'https://apiv2.bitcoinaverage.com/convert/global';
        conversionAPIUrl += `?from=${this.fromCurrency}&to=${this.toCurrency}&amount=${this.amount}`;

        const converted = axios.get(conversionAPIUrl, { 
            headers: { 'X-ba-key': process.env.BITCOINAVERAGE } 
        }).then((response) => {
            if (response.data.success) {
                return response.data.price;
            } else {
                throw new Error('Unable to fetch price conversion from BitcoinAverage');
            }
        });

        return converted;
    }

    reset({amount, from_currency, to_currency}) {
        this.fromCurrency = from_currency || 'USD';
        
        if (!amount || !to_currency) throw new Error('You must pass `amount` and `to_currency` in the arguments.');

        this.amount = amount;
        this.toCurrency = to_currency;
    }
}