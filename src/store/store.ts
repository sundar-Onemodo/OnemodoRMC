import authReducer from "@/store/authSlice";
import dateFilterReducer from "@/store/dateFilterSlice";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { combineReducers, configureStore } from "@reduxjs/toolkit";
import {
    FLUSH,
    PAUSE,
    PERSIST,
    persistReducer,
    PURGE,
    REGISTER,
    REHYDRATE
} from "redux-persist";
import persistStore from "redux-persist/es/persistStore";


const rootReducer = combineReducers({
    auth: authReducer,
    dateFilter: dateFilterReducer
})

const persistConfig = {
    key: "root",
    storage: AsyncStorage,
    whitelist: ["auth", "dateFilter"]
}

const persistedReducer = persistReducer(persistConfig, rootReducer)

export const store = configureStore({
    reducer: persistedReducer,
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: {
                ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER]
            },
        }),
});

export const persistor = persistStore(store);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;