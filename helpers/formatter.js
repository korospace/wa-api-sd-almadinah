const phoneNumberFormatter = function(number) {
  // 1. Menghilangkan karakter selain angka
  let formatted = number.replace(/\D/g, '');

  // 2. Menghilangkan angka 0 di depan (prefix)
  //    Kemudian diganti dengan 62
  if (formatted.startsWith('0')) {
    formatted = '62' + formatted.substr(1);
  }

  if (!formatted.endsWith('@c.us')) {
    formatted += '@c.us';
  }

  return formatted;
}

function isValidPhoneNumber(number) {
  // Implementasikan logika validasi nomor telepon Anda di sini
  // Contoh sederhana: memeriksa apakah nomor memiliki panjang yang benar
  return number.length === 12;
}

module.exports = {
  phoneNumberFormatter,
  isValidPhoneNumber
}