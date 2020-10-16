'use strict';
module.exports = (sequelize, DataTypes) => {
  const BitcoinAddress = sequelize.define(
    'BitcoinAddress',
    {
      id: {
        unique: true,
        allowNull: false,
        primaryKey: true,
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
      },
      seg_wit_address: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      balance: {
        type: DataTypes.DECIMAL,
        defaultValue: 0.0,
      },
      redeem_script: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      private_key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      public_key: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      wif: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      address: {
        type: DataTypes.STRING,
        allowNull: false,
      },
      destination_address: {
        type: DataTypes.STRING,
      },
      active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
        allowNull: false,
      },
      deposit_amount: {
        type: DataTypes.DECIMAL,
        defaultValue: 0.0,
      },
      expires_at: {
        type: DataTypes.DATE,
      },
      central: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
      released: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {}
  );
  BitcoinAddress.associate = function (models) {
    BitcoinAddress.hasOne(models.BTCTransaction);
  };
  return BitcoinAddress;
};
