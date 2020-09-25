const openpgp = require ('openpgp');


class PGPService {
    static async generateKey({ email, name, userIds, passphrase }) {
      debugger;
        let user_ids;
        if (String(name) && String(email)){
            user_ids = [{ name: name, email: email }]
        } else {
            user_ids = userIds;
        }

        const options = {
            numBits: 2048,
            userIds: user_ids,
            passphrase: passphrase
        };

        try {
            console.log(`Generating PGP Key for: ${name}`);

            const keys = await openpgp.generateKey(options).then((key) => {
                return {
                    privkey: key.privateKeyArmored,
                    pubkey: key.publicKeyArmored
                }
            });

            return keys
        } catch (e) {
            console.log(e);

            throw(e);
        }
    }
}

export default PGPService;
