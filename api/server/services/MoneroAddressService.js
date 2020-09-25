import database from '../src/models';

class MoneroAddressService {
  static async getAllAddresses() {
    try {
      return await database.MoneroAddress.findAll();
    } catch (error) {
      throw error;
    }
  }

  static async addAddress(newAddress) {
    try {
      return await database.MoneroAddress.create(newAddress);
    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  static async updateAddress(id, updateAddress) {
    try {
      const addressToUpdate = await database.MoneroAddress.findOne({
        where: { id: String(id) }
      });

      if (addressToUpdate) {
        await database.MoneroAddress.update(updateAddress, {
          where: { id: String(id) }
        });
        return updateAddress;
      }

      return null;
    } catch (error) {
      throw error;
    }
  }

  static async getAnAddress(id) {
    try {
      const theAddress = await database.MoneroAddress.findOne({
        where: { id: String(id) }
      });

      return theAddress;
    } catch (error) {
      throw error;
    }
  }

  static async deleteAddress(id) {
    try {
      const addressToDelete = await database.MoneroAddress.findOne({
        where: { id: String(id) }
      });

      if (addressToDelete) {
        const deletedAddress = await database.MoneroAddress.destroy({
          where: { id: String(id) }
        });
        return deletedAddress;
      }
      
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findAddressByWalletId(walletId) {
    try {
      const theAddress = await database.MoneroAddress.findOne({
        where: { wallet_id: String(walletId) }
      });

      return theAddress;
    } catch (e) {
      throw e;
    }
  }

  static async findAddressBySubaddressIndex(subaddressIndex) {
    try {
      const theAddress = await database.MoneroAddress.findOne({
        where: { subaddressIndex: Number(subaddressIndex) }
      });

      return theAddress;
    } catch (e) {
      throw e;
    }
  }

  static async findByAddress(address) {
    try {
      const theAddress = await database.MoneroAddress.findOne({
        where: { address: address }
      });

      return theAddress;
    } catch (error) {
      throw error;
    }
  }
}

export default MoneroAddressService;
