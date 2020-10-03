import database from '../src/models';

class BitcoinAddressService {
  static async getAllAddresses() {
    try {
      return await database.BitcoinAddress.findAll();
    } catch (error) {
      throw error;
    }
  }

  static async addAddress(newAddress) {
    try {
      return await database.BitcoinAddress.create(newAddress);
    } catch (error) {
      console.log(error)
      throw error;
    }
  }

  static async updateAddress(id, updateAddress) {
    try {
      const addressToUpdate = await database.BitcoinAddress.findOne({
        where: { id: Number(id) }
      });

      if (addressToUpdate) {
        await database.BitcoinAddress.update(updateAddress, {
          where: { id: Number(id) }
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
      const theAddress = await database.BitcoinAddress.findOne({
        where: { id: Number(id) }
      });

      return theAddress;
    } catch (error) {
      throw error;
    }
  }

  static async deleteAddress(id) {
    try {
      const addressToDelete = await database.BitcoinAddress.findOne({
        where: { id: Number(id) }
      });

      if (addressToDelete) {
        const deletedAddress = await database.BitcoinAddress.destroy({
          where: { id: Number(id) }
        });

        return deletedAddress;
      }
      return null;
    } catch (error) {
      throw error;
    }
  }

  static async findByAddress(address) {
    try {
      const theAddress = await database.BitcoinAddress.findOne({
        where: { address: address }
      });

      return theAddress;
    } catch (error) {
      throw error;
    }
  }
}

export default BitcoinAddressService;
