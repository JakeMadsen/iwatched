let _io = null;

module.exports = {
  setIo(io){ _io = io; },
  getIo(){ return _io; },
  emit(event, payload){ try { if(_io) _io.emit(event, payload); } catch(_){} }
}

