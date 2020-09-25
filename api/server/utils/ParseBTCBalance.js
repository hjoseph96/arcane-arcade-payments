export default  class ParseBTCBalance {
    parse(btcBalance) {
        if (typeof btcBalance !== 'string') btcBalance = btcBalance.toString();

        const len = btcBalance.length;
        if (!btcBalance.includes('.') && btcBalance.length <= 8) {
            const numOfZeroes = 8 - len;
            
            btcBalance = `0.${'0'.repeat(numOfZeroes)}${btcBalance}`;
        }
     
        return parseFloat(btcBalance);
    }
}