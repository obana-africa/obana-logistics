const db = require('../models/db.js')
const Category = db.categories
const Brands = db.brand
/**
 * Create Endpoint
 * @param req
 * @param res
 **/
const pullZoohoCat = async (req, res) => {
    const categories = await Category.findAll()
    let categoryIds = categories.length > 0 ? categories.map(categories => categories.category_id) : []
    const newCategories = req.body?.categories
    if (!newCategories) return res.status(500).send("categories is missing in the body")
    for (let cat of newCategories) {

        if (!categoryIds.includes(cat.category_id)) {
            await Category.create({
                category_id: cat.category_id,
                name: cat.name,
                parent_id: cat.parent_category_id == cat.category_id ?
                    null : cat.parent_category_id,
                status: "active"
            })
        }
    }
    return res.status(200).send(categoryIds)
}

const pullBrand = async (req, res) => {
    const brands = await Brands.findAll()
    let brandIds = brands.length > 0 ? brands.map(brand => brand.brand_id) : []
    const newBrands = req.body?.brands
    if (!newBrands) return res.status(500).send("brands is missing in the body")
    for (let brand of newBrands) {
        if (!brandIds.includes(brand.brand_id)) {
            await Brands.create({
                brand_id: brand.brand_id,
                name: brand.name,
                status: "active"
            })
        }
    }
    return res.status(200).send(brands)
}

module.exports = {
    pullZoohoCat,
    pullBrand
}