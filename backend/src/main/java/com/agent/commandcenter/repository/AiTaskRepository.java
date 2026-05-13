package com.agent.commandcenter.repository;

import com.agent.commandcenter.model.AiTask;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.UUID;

public interface AiTaskRepository extends JpaRepository<AiTask, UUID> {
}
