-- Update existing gacha item probabilities to match the rarity scale.
UPDATE public.gacha_items
SET probability = CASE rarity
  WHEN '일반' THEN 15
  WHEN '레어' THEN 10
  WHEN '에픽' THEN 5
  WHEN '유니크' THEN 4
  WHEN '시크릿' THEN 1
  ELSE probability
END
WHERE rarity IN ('일반', '레어', '에픽', '유니크', '시크릿');
