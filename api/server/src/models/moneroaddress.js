'use strict';
module.exports = (sequelize, DataTypes) => {
  const MoneroAddress = sequelize.define('MoneroAddress', {
    id: {
      unique: true,
      allowNull: false,
      primaryKey: true,
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4
    },
    active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: false
    },
    balance: {
      type: DataTypes.BIGINT,
      defaultValue: 0.0
    },
    central: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    },
    address: {
      type: DataTypes.STRING,
      allowNull: false
    },
    deposit_amount: {
      type: DataTypes.DECIMAL,
      defaultValue: 0.0
    },
    expires_at: {
      type: DataTypes.DATE
    },
    subaddressIndex: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    released: {
      type: DataTypes.BOOLEAN,
      defaultValue: false
    }
  }, {});

  MoneroAddress.associate = function(models) {
    MoneroAddress.hasOne(models.XMRTransaction, { foreign_key: 'monero_address_id' });
  };

  return MoneroAddress;
};
