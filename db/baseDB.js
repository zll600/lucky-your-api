module.exports = class BaseDB {
  static getDB() {
    return null
  }

  static async insert(obj) {
    const db = this.getDB()

    return db.create(obj)
  }

  static async batchInsert(objs) {
    const db = this.getDB()

    return db.insertMany(objs)
  }

  static async getAll() {
    const db = this.getDB()

    return db.find({}).exec()
  }

  static async getById(id) {
    const db = this.getDB()

    return db.findById(id).exec()
  }

  static async delete(condition) {
    const db = this.getDB()

    return db.deleteMany(condition).exec()
  }

  static async update(condition,doc) {
    const db = this.getDB()
    
    return db.updateMany(condition,doc).exec()
  }
  
  static async batchDelete(idArray) {
    const db = this.getDB()

    return db.remove({ _id: { $in: idArray } }).exec()
  }

  static async findOneAndUpdate(condition, doc) {
    const db = this.getDB()

    return db.findOneAndUpdate(condition, doc, { upsert: true, new: true })
  }

  static async getOneByCondition(condition) {
    const db = this.getDB()
    
    return db.findOne(condition).exec()
  }

  static async getByCondition(condition, select) {
    const db = this.getDB()

    return db.find(condition).select(select).exec()
  }

  static async getOneByConditionAndSortBy(condition, sort) {
    const db = this.getDB()

    return db.findOne(condition).sort(sort).exec()
  }

  static async getListByCondition(condition, pageSize, pageNo, sort) {
    const db = this.getDB()

    return db.find(condition).sort(sort).skip((pageNo - 1) * pageSize).limit(pageSize).exec()
  }

  static async getCountByCondition(condition) {
    const db = this.getDB()

    return db.find(condition).count()
  }
}