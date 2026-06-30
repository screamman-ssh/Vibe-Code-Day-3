import { realApi } from './realApi.js'
import { mockApi } from './mock/client.js'

// Default to mockApi for quick prototyping, set 'useRealApi' to 'true' in localStorage to connect to Go REST API
const useRealApi = localStorage.getItem('useRealApi') === 'true'
export const api = useRealApi ? realApi : mockApi

