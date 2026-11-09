const WalletTransaction = require("../models/WalletTransaction");

async function addWalletEntry(entry, session) {
  await WalletTransaction.create([entry], { session });
}

module.exports = { addWalletEntry };
