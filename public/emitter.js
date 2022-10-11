class Emitter {
    #events = {}

    on(name, callback) {
        if(!this.#events[name]) {
            this.#events[name] = []
        };

        this.#events[name].push(callback)
    }

    emit(name, data) {
        if(!this.#events[name]) return;
        this.#events[name].forEach(callback => {
            callback(data)
        })
    }

    removeListener(name, callback) {
        if(!this.#events[name]) return;
        this.#events[name] = this.#events[name].filter(cb => cb !== callback)
    }
}

export const emitter = new Emitter()