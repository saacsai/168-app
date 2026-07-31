-- Seed: 2 tarefas de teste para visualizar Post-its no hub mobile
-- Execute no Supabase SQL Editor do projeto meudia (umlmqjkahrobfnigltil)

DO $$
DECLARE
  v_instance_id uuid;
  v_group1_id   uuid;
  v_group2_id   uuid;
BEGIN
  -- Pegar instance ativa do Luciano
  SELECT i.id INTO v_instance_id
  FROM instances i
  JOIN auth.users u ON u.id = i.user_id
  WHERE u.email = 'luciano.maeda@saacs.com.br'
    AND i.active = true
  LIMIT 1;

  IF v_instance_id IS NULL THEN
    RAISE EXCEPTION 'Instância não encontrada para luciano.maeda@saacs.com.br';
  END IF;

  -- Pegar (ou criar) 2 grupos de contato com cores diferentes
  SELECT id INTO v_group1_id FROM contact_groups
  WHERE instance_id = v_instance_id ORDER BY created_at LIMIT 1;

  IF v_group1_id IS NULL THEN
    INSERT INTO contact_groups (instance_id, name, color)
    VALUES (v_instance_id, 'Trabalho', '#2A5F6B')
    RETURNING id INTO v_group1_id;
  END IF;

  SELECT id INTO v_group2_id FROM contact_groups
  WHERE instance_id = v_instance_id AND id != v_group1_id
  ORDER BY created_at LIMIT 1;

  IF v_group2_id IS NULL THEN
    INSERT INTO contact_groups (instance_id, name, color)
    VALUES (v_instance_id, 'Pessoal', '#7C3AED')
    RETURNING id INTO v_group2_id;
  END IF;

  -- Tarefa 1: vence hoje, grupo 1
  INSERT INTO tasks (instance_id, title, date, due_date, status, origin_group_id)
  VALUES (v_instance_id, 'Revisar proposta CooperLiga', CURRENT_DATE, CURRENT_DATE, 'pendente', v_group1_id);

  -- Tarefa 2: atrasada (ontem), grupo 2
  INSERT INTO tasks (instance_id, title, date, due_date, status, origin_group_id)
  VALUES (v_instance_id, 'Ligar para gestora da cooperativa', CURRENT_DATE - 1, CURRENT_DATE - 1, 'pendente', v_group2_id);

  RAISE NOTICE 'Tarefas criadas com sucesso para instance_id: %', v_instance_id;
END $$;
