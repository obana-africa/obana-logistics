const { validator } = require('express-validator')
const { Op } = require('sequelize')
const db = require('../models/db.js')
const utils = require('../../utils.js')
const requestController = require('../controllers/requestController')
const cartController = require('./cartController.js')

const Wish = db.wish_list


/**
 * Method to complete user creation request
 * @param payload
 *   Required 
 *     sku: string
 * @param res 
 * @returns {*} StoreProducts
 **/
const addProduct = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }

    const product = req.body.productId
    if (!product) {
        return res.status(400).send(
            utils.responseError('productId can not be empty!')
        )
    }

    let wish = await Wish.findOne({ where: { user_id: user.id } })

    if (!wish) {
        wish = await Wish.create({ user_id: user.id })
    }

    let wishList = wish.products

    if (!wishList) wish.products = product
    else wish.products = Array.from(new Set(wishList.split(',').concat([product]))).toString()
    await wish.save()

    const wishListProducts = await cartController.getZohoMultipleProducts(wish.products.split(','))
    return res.status(201).send(
        utils.responseSuccess(wishListProducts)
    )
}

/**
 * Method to remove products from wish list
 * @param {*} user_id 
 * @param {*} attributes 
 * @param {*} parent_id - 
 */
const removeProduct = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }

    const product = req.body.productId
    if (!product) {
        return res.status(400).send(
            utils.responseError('productId can not be empty!')
        )
    }

    const wish = await Wish.findOne({ where: { user_id: user.id } })

    if (!wish) {
        return res.status(400).send(
            utils.responseError('Agent do not have any wish list at the moment!')
        )
    }
    let wishProducts = wish.products
    if (wishProducts) {
        wish.products = wishProducts.split(',').filter((item) => { return item != product }).toString()
        await wish.save()
    }


    if (!wish.products) {
        return res.status(201).send(
            utils.responseSuccess([])
        )
    }

    const wishListProducts = await cartController.getZohoMultipleProducts(wish.products.split(','))
    if (wishListProducts)
        return res.status(201).send(
            utils.responseSuccess(wishListProducts)
        )
    else return []
}

/**
 * Method to store and it's products
 * @param req
 * @param res 
 * @returns {Wish} Store
 **/
const getWishList = async (req, res) => {
    const user = req.user
    if (!user) {
        return res.status(401).send(
            utils.responseError('You are not authorized to access this resource!!')
        )
    }

    const wish = await Wish.findOne({ where: { user_id: user.id } })

    if (!wish?.products) {
        return res.status(201).send(
            utils.responseSuccess([])
        )
    }

    const products = await getWishDetails(wish)
    return res.status(201).send(
        utils.responseSuccess(products)
    )

}

const getWishDetails = async (wish) => {
    let wishProducts = await cartController.getZohoMultipleProducts(wish.products.split(','))
    if (!wishProducts?.items) return wishProducts
    let formatedResponse = []
    for (let product of wishProducts.items) {
        product.image_Url = cartController.getCustomFieldValue(product, 'cf_singleimage')
        formatedResponse.push(product)
    }
    return { "items": formatedResponse }
}



module.exports = {
    addProduct,
    removeProduct,
    getWishList
}