let CurrentCompute = undefined;

let effectQueue = [];

export class Reactive {
  constructor(fnOrValue, effect) {
    this.qq = 0;
    this.sources = null;
    this.sourceSlots = null;
    this.observers = null;
    this.observerSlots = null;
    if (typeof fnOrValue === "function") {
      this.state = 1
      this.fn = fnOrValue;
      this.value = undefined;
      this.effect = effect;
    } else {
      this.fn = undefined;
      this.value = fnOrValue;
      this.effect = false;
      this.state = 0;
    }
    if (effect) this.update();
  }
  stale(sway) {
    const a = this.state > 0;
    this.state += sway;
    const b = this.state > 0;
    if (a ^ b) {
      if (b) {
        if (this.effect && this.qq === 0) {
          effectQueue.push(this);
          this.qq++;
        }
      }
      const c=-1+(b<<1);
      if (!this.effect && this.observers) {
        for (let i = 0; i < this.observers.length; i++) {
          this.observers[i].stale(c);
        }
      }
    }
  }
  
  set(value) {
    const oldValue = this.value;
    this.value = value;
    // this.stale(-this.state);
    // if ((oldValue !== this.value) && this.observers) {
    //   for (let i = 0; i < this.observers.length; i++) {
    //     this.observers[i].stale(1);
    //   }
    // }
    if ((oldValue !== this.value)){
      if(this.state===0){
        this.stale(1);
      }
      // this.stale(-this.state,(oldValue !== this.value));
    }else{
      this.stale(-this.state);
    }
    this.state=0;
  }

  update() {
    const oldValue = this.value;
    const listener = CurrentCompute;
    CurrentCompute = this;
    try {
      this.value = this.fn();
    } finally {
      CurrentCompute = listener;
    }
    if ((oldValue !== this.value)){
      if(this.state===0){
        this.stale(1);
      }
      // this.stale(-this.state,(oldValue !== this.value));
    }else{
      this.stale(-this.state);
    }
    this.state=0;
    // if ((oldValue !== this.value) && this.observers) {
    //   for (let i = 0; i < this.observers.length; i++) {
    //     this.observers[i].stale(1);
    //   }
    // }
  }

  updateIfNecessary() {
    if (!this.fn) return;
    if (this.state > 0) {
      if (this.sources) {
        for (let i = 0; i < this.sources.length; i++) {
          this.sources[i].updateIfNecessary();
        }
      }
      if (this.state > 0) {
        if (this.sources) {
          cleanNode(this);
        }
        this.update();
      }
    }
  }

  get() {
    if (CurrentCompute) {
      const sSlot = this.observers ? this.observers.length : 0;
      if (!CurrentCompute.sources) {
        CurrentCompute.sources = [this];
        CurrentCompute.sourceSlots = [sSlot];
      } else {
        CurrentCompute.sources.push(this);
        CurrentCompute.sourceSlots.push(sSlot);
      }
    }
    const ss = this.state;
    this.updateIfNecessary();
    if (CurrentCompute) {
      if (ss * this.state > 0) {
        CurrentCompute.stale(1);
      }
      if (!this.observers) {
        this.observers = [CurrentCompute];
        this.observerSlots = [CurrentCompute.sources.length - 1];
      } else {
        this.observers.push(CurrentCompute);
        this.observerSlots.push(CurrentCompute.sources.length - 1);
      }
    }

    return this.value;
  }
}

function cleanNode(node) {
  while (node.sources.length) {
    const source = node.sources.pop(),
      index = node.sourceSlots.pop(),
      obs = source.observers;
    if (obs && obs.length) {
      const n = obs.pop(),
        s = source.observerSlots.pop();
      if (index < obs.length) {
        n.sourceSlots[s] = index;
        obs[index] = n;
        source.observerSlots[index] = s;
      }
    }
  }
}

function setSignal(value) {
  this.set(value);
  stabilize();
}
export function signal(value) {
  const signal = new Reactive(value);
  return [signal.get.bind(signal), setSignal.bind(signal)];
}

export function computed(fn) {
  const computed = new Reactive(fn, true);
  return computed.get.bind(computed);
}

export function stabilize() {
  for (let i = 0; i < effectQueue.length; i++) {
    effectQueue[i].qq--;
    effectQueue[i].get();
  }
  effectQueue.length = 0;
}
