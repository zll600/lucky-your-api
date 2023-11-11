declare namespace _redis {
  type Callback<T> = (err: Error | null, res: T) => void
  type KeyType = string | Buffer
  type ValueType = string | Buffer | number | any[]
  type Ok = 'OK'

  interface Commands {
    setbitEx(key: KeyType, offset: number, value: ValueType, expireSeconds: number): Promise<number>

    incrEx(key: KeyType, expireSeconds: number): Promise<number>

    decrEx(key: KeyType, expireSeconds: number): Promise<number>

    lsetEx(key: KeyType, index: number, value: ValueType, expireSeconds: number): Promise<Ok>

    saddEx(key: KeyType, arg1: ValueType[], expireSeconds: number): Promise<number>
    saddEx(key: KeyType, ...args: ValueType[], expireSeconds: number): Promise<number>

    zaddEx(key: KeyType, arg1: KeyType[] | number[], expireSeconds: number): Promise<number | string>
    zaddEx(key: KeyType, ...args: KeyType[] | number[], expireSeconds: number): Promise<number | string>

    zincrbyEx(key: KeyType, increment: number, member: string, expireSeconds: number): Promise<string>

    hsetEx(key: KeyType, data: ValueType[] | { [key: string]: ValueType } | Map<string, ValueType>): Promise<number>

    incrbyEx(key: KeyType, increment: number, expireSeconds: number): Promise<number>

    decrbyEx(key: KeyType, decrement: number, expireSeconds: number): Promise<number>

    rpushEx(key: KeyType, arg1: ValueType[], expireSeconds: number): Promise<number>
    rpushEx(key: KeyType, ...args: ValueType[], expireSeconds: number): Promise<number>

    lpushEx(key: KeyType, arg1: ValueType[], expireSeconds: number): Promise<number>
    lpushEx(key: KeyType, ...args: ValueType[], expireSeconds: number): Promise<number>

    rpushxEx(key: KeyType, arg1: ValueType[], expireSeconds: number): Promise<number>
    rpushxEx(key: KeyType, ...args: ValueType[], expireSeconds: number): Promise<number>

    lpushxEx(key: KeyType, arg1: ValueType[], expireSeconds: number): Promise<number>
    lpushxEx(key: KeyType, ...args: ValueType[], expireSeconds: number): Promise<number>
  }

}
