import Util from '../utils/Utils';
import PGPService from '../services/PGPService';

const util = new Util();
const openpgp = require ('openpgp');

export default class PGPController {

    static async generateChatKeys(req, res) {
        const { user_ids, passphrase } = req.body;

        if (!String(passphrase)) {
            util.setError(400, 'Provide complete details to generatekeys for this OrderDisputeChat');

            return util.send(res);
        }

        try {
            const userIds = JSON.parse(user_ids);
            const keys = await PGPService.generateKey({
                userIds: userIds,
                passphrase: passphrase
            });

            util.setSuccess(200, 'Successfully enqueued key generation.', {
                pubkey: keys.pubkey,
                privkey: keys.privkey
            });

            return util.send(res);
        } catch (e) {
            console.log(e);

            util.setError(400, e);
            return util.send(res);
        }
    }

    static async encryptMessage(req, res) {
        const { public_key, message } = req.body;

        if (!String(public_key) || !String(message)) {
            util.setError(400, 'Provide complete details to encrypt your message.');
            return util.send(res);
        }

        try {
            const pgpOptions = {
                message: openpgp.message.fromText(message),
                publicKeys: (await openpgp.key.readArmored(public_key)).keys,
            };

            const encrypted = await openpgp.encrypt(pgpOptions);

            util.setSuccess(200, 'Successfully encrypted new PGP message.', JSON.stringify(encrypted.data));
            return util.send(res);
        } catch (e) {
            console.log(e);

            util.setError(400, e);
            return util.send(res);
        }
    }

    static async decryptMessage(req, res) {
        const { public_key, private_key, passphrase, cipher } = req.body;

        if (!String(public_key) || !String(cipher) || !String(passphrase)) {
            util.setError(400, 'Provide complete details to encrypt your message.');
            return util.send(res);
        }

        const privKeyObj = (await openpgp.key.readArmored(private_key)).keys[0];
        await privKeyObj.decrypt(passphrase);

        try {
            const pgpOptions = {
                privateKeys: [privKeyObj],
                message: await openpgp.message.readArmored(cipher).then((message) => { return message; }),
                publicKeys: (await openpgp.key.readArmored(public_key)).keys
            };
            const decrypted = await openpgp.decrypt(pgpOptions);

            util.setSuccess(200, 'Successfully decrypted message.', decrypted);
            return util.send(res);
        } catch (e) {
            console.log(e);

            util.setError(400, e.message);
            return util.send(res);
        }
    }
}
