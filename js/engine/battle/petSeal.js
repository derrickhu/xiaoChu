function isPetSealed(g, pet, index) {
  if (!pet || !g.heroBuffs) return false
  return g.heroBuffs.some(b => b && b.type === 'petSeal' && (b.petIdx === index || (b.petIdx == null && b.petId === pet.id)))
}

module.exports = { isPetSealed }
