import { describe, it, expect } from 'vitest'
import {
  referenceImages,
  describeCharacter,
  castDirective,
  panelPrompt,
  referencePrompt,
  posePrompt,
  usableReference,
  checkCast,
  POSE_PRESETS,
  MAX_REFERENCES,
  type Character,
} from '@/lib/characters/cast'

const pip: Character = {
  id: '1',
  name: 'Pip',
  appearance: 'a small hedgehog with a rainbow-striped scarf and one bent ear',
  imageUrl: 'https://cdn.test/characters/pip.png',
}

const bo: Character = {
  id: '2',
  name: 'Bo',
  appearance: 'a tall green frog in yellow wellington boots',
  imageUrl: 'https://cdn.test/characters/bo.png',
}

describe('picking reference images', () => {
  it('sends one picture of each character before a second of anyone', () => {
    // A two-hander that sent three pictures of the first character would
    // steady one face and let the other drift, which is the failure this
    // whole feature exists to prevent.
    expect(referenceImages([pip, bo])).toEqual([pip.imageUrl, bo.imageUrl])
  })

  it('fills the remaining slots with primary poses', () => {
    const withPoses: Character = {
      ...pip,
      poses: [
        { imageUrl: 'https://cdn.test/pip-side.png', primary: true },
        { imageUrl: 'https://cdn.test/pip-sad.png', primary: false },
      ],
    }

    expect(referenceImages([withPoses, bo])).toEqual([
      pip.imageUrl,
      bo.imageUrl,
      'https://cdn.test/pip-side.png',
    ])
  })

  it('never exceeds the limit', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      id: String(i),
      name: `C${i}`,
      imageUrl: `https://cdn.test/${i}.png`,
    }))

    expect(referenceImages(many)).toHaveLength(MAX_REFERENCES)
  })

  it('deduplicates, because a repeat wastes a slot someone else needed', () => {
    const twin = { ...bo, id: '3', imageUrl: pip.imageUrl }

    expect(referenceImages([pip, twin])).toEqual([pip.imageUrl])
  })

  it('skips characters that have no picture', () => {
    expect(referenceImages([{ id: '9', name: 'Ghost' }, pip])).toEqual([pip.imageUrl])
  })

  it('returns nothing for an empty cast', () => {
    expect(referenceImages([])).toEqual([])
  })
})

describe('describing a character', () => {
  it('leads with the name, because the script refers to them by it', () => {
    expect(describeCharacter(pip)).toBe(
      'Pip: a small hedgehog with a rainbow-striped scarf and one bent ear'
    )
  })

  it('falls back to the name alone when there is no appearance', () => {
    expect(describeCharacter({ id: '1', name: 'Pip' })).toBe('Pip')
  })

  it('produces nothing without a name', () => {
    expect(describeCharacter({ id: '1', name: '   ' })).toBe('')
  })

  it('collapses whitespace so a pasted description does not break the prompt', () => {
    expect(describeCharacter({ id: '1', name: 'Pip', appearance: 'a  small\n\nhedgehog' })).toBe(
      'Pip: a small hedgehog'
    )
  })
})

describe('the cast directive', () => {
  it('says nothing for an empty cast', () => {
    // A customer who never opens Character Studio must get exactly the
    // prompt they got before.
    expect(castDirective([])).toBe('')
    expect(castDirective([{ id: '1', name: '' }])).toBe('')
  })

  it('lists everyone and forbids the shorthand that breaks panels', () => {
    const text = castDirective([pip, bo])

    expect(text).toContain('Pip:')
    expect(text).toContain('Bo:')
    expect(text).toContain('the same character as before')
  })

  it('tells the writer not to invent looks when pictures are attached', () => {
    // The model writing the prompts is not the model receiving the images,
    // and left alone it will describe a character the reference already
    // settles — sometimes contradicting it.
    const withPics = castDirective([pip], true)

    expect(withPics).toContain('Reference images')
    expect(withPics).toContain('do not invent new')
    expect(castDirective([pip], false)).not.toContain('Reference images')
  })
})

describe('the panel prompt', () => {
  it('puts the scene first and the cast after', () => {
    // Image models weight the opening of a prompt most heavily, and the
    // scene is the part that changes panel to panel. Leading with a
    // paragraph of unchanging appearance gives panels that are all portrait
    // and no story.
    const prompt = panelPrompt('Pip climbs a mossy wall at dusk', [pip], 'Pixar 3D')

    expect(prompt.indexOf('climbs a mossy wall')).toBeLessThan(prompt.indexOf('Pip: a small'))
    expect(prompt).toContain('Art style: Pixar 3D.')
  })

  it('works with no cast at all', () => {
    expect(panelPrompt('An empty street', [])).toBe('An empty street')
  })

  it('drops an empty style rather than writing "Art style: ."', () => {
    expect(panelPrompt('A street', [], '   ')).toBe('A street')
  })
})

describe('reference and pose prompts', () => {
  it('asks for a neutral, plain, full-body reference', () => {
    // Everything that makes a good illustration makes a bad reference: a
    // character mid-action against a sunset teaches the model the sunset.
    const prompt = referencePrompt(pip, 'Pixar 3D')

    expect(prompt).toContain('neutral pose')
    expect(prompt).toContain('white background')
    expect(prompt).toContain('no props')
    expect(prompt).toContain('Pip:')
    expect(prompt).toContain('Pixar 3D')
  })

  it('has an instruction for every pose it offers', () => {
    for (const preset of POSE_PRESETS) {
      const prompt = posePrompt(pip, preset.key)

      expect(prompt, preset.key).toContain(preset.instruction)
    }
  })

  it('tells a pose to keep the design identical to the reference', () => {
    expect(posePrompt(pip, 'side', 'Pixar 3D')).toContain('identical to the reference')
  })

  it('falls back to a forward pose for a key it does not know', () => {
    expect(posePrompt(pip, 'cartwheel')).toContain('facing forward')
  })
})

describe('whether a reference can actually be used', () => {
  it('accepts a public https URL', () => {
    expect(usableReference('https://cdn.test/a.png').ok).toBe(true)
  })

  it('refuses the backend’s own expiring output', () => {
    // Storing one produces a character that silently loses its face weeks
    // later, which nothing fails on at the time.
    const check = usableReference(
      'https://img.theapi.app/ephemeral/59522a41-9097-41b1-b277-44b2851c0744.png'
    )

    expect(check.ok).toBe(false)
    expect(check.reason).toContain('expires')
  })

  it('refuses an address the illustrator cannot reach', () => {
    expect(usableReference('http://localhost:3000/a.png').ok).toBe(false)
    expect(usableReference('http://127.0.0.1/a.png').ok).toBe(false)
    expect(usableReference('/uploads/a.png').ok).toBe(false)
    expect(usableReference('data:image/png;base64,AAAA').ok).toBe(false)
  })

  it('refuses nothing at all', () => {
    expect(usableReference('').ok).toBe(false)
    expect(usableReference(null).ok).toBe(false)
    expect(usableReference(undefined).ok).toBe(false)
  })
})

describe('checking a whole cast', () => {
  it('splits those with a usable picture from those without', () => {
    const { withReference, wordsOnly, problems } = checkCast([
      pip,
      { id: '3', name: 'Ghost' },
      { id: '4', name: 'Stale', imageUrl: 'https://img.theapi.app/ephemeral/x.png' },
    ])

    expect(withReference.map((c) => c.name)).toEqual(['Pip'])
    expect(wordsOnly.map((c) => c.name)).toEqual(['Ghost', 'Stale'])
    // A character with no picture is not a problem; a broken one is.
    expect(problems).toHaveLength(1)
    expect(problems[0].name).toBe('Stale')
  })

  it('reports nothing wrong with an all-words cast', () => {
    const { problems, wordsOnly } = checkCast([{ id: '1', name: 'Pip' }])

    expect(problems).toEqual([])
    expect(wordsOnly).toHaveLength(1)
  })
})
