module.exports = class BaseBusiness {
  static getModel() {
    return null
  }
  
  static async insert(obj) {
    const model = this.getModel()

    return model.insert(obj)
  }

  static async batchInsert(objs) {
    const model = this.getModel()

    return model.batchInsert(objs)
  }

  static async getAll() {
    const model = this.getModel()

    return model.getAll()
  }

  static async getById(id) {
    const model = this.getModel()

    return model.getById(id)
  }

  static async delete(condition) {
    const model = this.getModel()

    return model.delete(condition)
  }

  static async update(condition, doc) {
    const model = this.getModel()

    return model.update(condition, doc)
  }

  static async batchDelete(idArray) {
    const model = this.getModel()

    return model.batchDelete(idArray)
  }

  static async findOneAndUpdate(condition, doc) {
    const model = this.getModel()

    return model.findOneAndUpdate(condition, doc)
  }

  static async getOneByCondition(condition) {
    const model = this.getModel()

    return model.getOneByCondition(condition)
  }

  static async getByCondition(condition, select) {
    const model = this.getModel()

    return model.getByCondition(condition, select)
  }

  static async getOneByConditionAndSortBy(condition, sort) {
    const model = this.getModel()

    return model.getOneByConditionAndSortBy(condition, sort)
  }

  static async getListByCondition(condition, pageSize, pageNum, sort) {
    const model = this.getModel()

    return model.getListByCondition(condition, pageSize, pageNum, sort)
  }

  static async getCountByCondition(condition) {
    const model = this.getModel()

    return model.getCountByCondition(condition)
  }

}