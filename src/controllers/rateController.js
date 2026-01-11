const db = require('../models/db.js')
const rateHelper = require('../helpers/rateHelper')

const rate = db.rate;


/**
 * Method to calculate a given rate
 * @param req
 * @param res
 * @returns rate
 **/
const eval = async (slug, amount) => {
  //Create default rate if not exist.
  //TODO - This should be do from migration / seeder
  rateHelper.createDefaultAgentCommisionRate();

  let rateAmount = 0
  const commisionRate = await rate.findOne({ where: { slug } })

  if (commisionRate) {
    if (commisionRate.type == "percent")
      rateAmount = amount * (commisionRate.value / 100)
    if (commisionRate.type == "amount")
      rateAmount = commisionRate.value
  }

  return rateAmount
}

module.exports = {
  eval
}